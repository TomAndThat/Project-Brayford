/**
 * Firestore-Backed Rate Limiter
 *
 * Distributed rate limiting using Firestore as the backing store.
 * Uses sliding window algorithm to prevent abuse across multiple
 * Cloud Function instances.
 *
 * Rate limits are stored in: emailQueue/_rateLimits/{scope}/{type}
 */

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import type { EmailType } from '@brayford/core';
import { getRateLimitForType } from './config';

// ===== Types =====

/**
 * Rate limit document stored in Firestore
 */
interface RateLimitDocument {
  count: number;              // Emails sent in current window
  windowStart: Timestamp;     // Window start time
  lastUpdated: Timestamp;     // Last counter update
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  resetAt: Date;
  scope: string;
}

// ===== Constants =====

const RATE_LIMIT_COLLECTION = '_rateLimits';
const WINDOW_MS = 60 * 1000; // 1 minute sliding window

// ===== Rate Limiter Functions =====

/**
 * Get the Firestore path for a rate limit document
 */
function getRateLimitPath(scope: string, type: EmailType): string {
  // Sanitise scope for Firestore path (replace colons with underscores)
  const sanitisedScope = scope.replace(/:/g, '_');
  return `emailQueue/${RATE_LIMIT_COLLECTION}/${sanitisedScope}/${type}`;
}

/**
 * Check if an email is allowed under rate limits
 *
 * @param scope - Rate limit scope (e.g., 'user:abc123', 'organization:org-456', 'global')
 * @param type - Email type
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  scope: string,
  type: EmailType
): Promise<RateLimitResult> {
  const db = getFirestore();
  const config = getRateLimitForType(type);
  const docPath = getRateLimitPath(scope, type);
  const docRef = db.doc(docPath);

  const now = Timestamp.now();
  const windowStart = Timestamp.fromMillis(now.toMillis() - WINDOW_MS);

  try {
    const doc = await docRef.get();

    if (!doc.exists) {
      // No rate limit document - allowed
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: config.maxPerMinute,
        resetAt: new Date(now.toMillis() + WINDOW_MS),
        scope,
      };
    }

    const data = doc.data() as RateLimitDocument;

    // Check if window has expired (reset if so)
    if (data.windowStart.toMillis() < windowStart.toMillis()) {
      // Window expired - allowed
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: config.maxPerMinute,
        resetAt: new Date(now.toMillis() + WINDOW_MS),
        scope,
      };
    }

    // Window still active - check count
    const allowed = data.count < config.maxPerMinute;
    const resetAt = new Date(data.windowStart.toMillis() + WINDOW_MS);

    return {
      allowed,
      currentCount: data.count,
      maxAllowed: config.maxPerMinute,
      resetAt,
      scope,
    };
  } catch (error) {
    logger.error('Rate limit check failed', { scope, type, error });
    // On error, allow the email (fail open) but log for monitoring
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: config.maxPerMinute,
      resetAt: new Date(now.toMillis() + WINDOW_MS),
      scope,
    };
  }
}

/**
 * Increment the rate limit counter after sending an email
 *
 * Uses Firestore transactions to ensure atomic updates across
 * multiple concurrent function invocations.
 *
 * @param scope - Rate limit scope
 * @param type - Email type
 */
export async function incrementRateLimit(
  scope: string,
  type: EmailType
): Promise<void> {
  const db = getFirestore();
  const docPath = getRateLimitPath(scope, type);
  const docRef = db.doc(docPath);

  const now = Timestamp.now();
  const windowStart = Timestamp.fromMillis(now.toMillis() - WINDOW_MS);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        // Create new rate limit document
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          lastUpdated: now,
        });
        return;
      }

      const data = doc.data() as RateLimitDocument;

      if (data.windowStart.toMillis() < windowStart.toMillis()) {
        // Window expired - reset counter
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          lastUpdated: now,
        });
      } else {
        // Window still active - increment counter
        transaction.update(docRef, {
          count: FieldValue.increment(1),
          lastUpdated: now,
        });
      }
    });
  } catch (error) {
    // Log but don't fail - rate limiting is a safety measure, not critical path
    logger.error('Rate limit increment failed', { scope, type, error });
  }
}

/**
 * Check rate limit and increment if allowed (atomic operation)
 *
 * Returns the result of the check. If allowed, the counter is incremented.
 * This is the recommended function for most use cases.
 *
 * @param scope - Rate limit scope
 * @param type - Email type
 * @returns Rate limit result (allowed is true if email can be sent)
 */
export async function checkAndIncrementRateLimit(
  scope: string,
  type: EmailType
): Promise<RateLimitResult> {
  const db = getFirestore();
  const config = getRateLimitForType(type);
  const docPath = getRateLimitPath(scope, type);
  const docRef = db.doc(docPath);

  const now = Timestamp.now();
  const windowStart = Timestamp.fromMillis(now.toMillis() - WINDOW_MS);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        // Create new rate limit document with count of 1
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          lastUpdated: now,
        });

        return {
          allowed: true,
          currentCount: 1,
          maxAllowed: config.maxPerMinute,
          resetAt: new Date(now.toMillis() + WINDOW_MS),
          scope,
        };
      }

      const data = doc.data() as RateLimitDocument;

      if (data.windowStart.toMillis() < windowStart.toMillis()) {
        // Window expired - reset counter to 1
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          lastUpdated: now,
        });

        return {
          allowed: true,
          currentCount: 1,
          maxAllowed: config.maxPerMinute,
          resetAt: new Date(now.toMillis() + WINDOW_MS),
          scope,
        };
      }

      // Window still active - check if we can increment
      if (data.count >= config.maxPerMinute) {
        // Rate limit exceeded
        return {
          allowed: false,
          currentCount: data.count,
          maxAllowed: config.maxPerMinute,
          resetAt: new Date(data.windowStart.toMillis() + WINDOW_MS),
          scope,
        };
      }

      // Increment counter
      transaction.update(docRef, {
        count: FieldValue.increment(1),
        lastUpdated: now,
      });

      return {
        allowed: true,
        currentCount: data.count + 1,
        maxAllowed: config.maxPerMinute,
        resetAt: new Date(data.windowStart.toMillis() + WINDOW_MS),
        scope,
      };
    });

    return result;
  } catch (error) {
    logger.error('Rate limit check and increment failed', { scope, type, error });
    // Fail open - allow the email but log for monitoring
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: config.maxPerMinute,
      resetAt: new Date(now.toMillis() + WINDOW_MS),
      scope,
    };
  }
}

/**
 * Reset rate limit for a scope/type (for testing or manual intervention)
 */
export async function resetRateLimit(
  scope: string,
  type: EmailType
): Promise<void> {
  const db = getFirestore();
  const docPath = getRateLimitPath(scope, type);
  
  try {
    await db.doc(docPath).delete();
    logger.info('Rate limit reset', { scope, type });
  } catch (error) {
    logger.error('Rate limit reset failed', { scope, type, error });
    throw error;
  }
}
