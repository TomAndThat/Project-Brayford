/**
 * Rate Limiter
 * 
 * Simple in-memory rate limiting for transactional emails.
 * Uses sliding window algorithm to prevent abuse.
 * 
 * Phase 1: In-memory counters (sufficient for single-instance functions)
 * Phase 2: Firestore-based for distributed rate limiting (deferred)
 */

import type { EmailType, RateLimitConfig, RateLimitResult, RateLimitOptions } from './types';

/**
 * Rate limit configurations by email type
 */
const RATE_LIMIT_CONFIGS: Record<EmailType, RateLimitConfig> = {
  'invitation': {
    maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_INVITATION || '10'),
    scope: 'organization',
  },
  'password-reset': {
    maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET || '5'),
    scope: 'user',
  },
  'verification': {
    maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_VERIFICATION || '5'),
    scope: 'user',
  },
  'event-reminder': {
    maxPerMinute: 100, // Bulk emails handled separately in Phase 2
    scope: 'global',
  },
  'weekly-digest': {
    maxPerMinute: 100,
    scope: 'global',
  },
  'marketing': {
    maxPerMinute: 100,
    scope: 'global',
  },
  'billing-invoice': {
    maxPerMinute: 20, // Higher limit for transactional billing
    scope: 'organization',
  },
};

/**
 * Request timestamp tracker
 */
interface RequestWindow {
  timestamps: number[];
  resetAt: number;
}

/**
 * In-memory rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private windows: Map<string, RequestWindow> = new Map();
  private windowDurationMs = 60000; // 1 minute
  
  /**
   * Check if a request is within rate limits
   */
  checkLimit(type: EmailType, scopeId: string): RateLimitResult {
    const config = RATE_LIMIT_CONFIGS[type];
    const key = `${type}:${scopeId}`;
    const now = Date.now();
    
    // Get or create window
    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = {
        timestamps: [],
        resetAt: now + this.windowDurationMs,
      };
      this.windows.set(key, window);
    }
    
    // Remove timestamps outside the sliding window
    const windowStart = now - this.windowDurationMs;
    window.timestamps = window.timestamps.filter(ts => ts > windowStart);
    
    // Check if limit exceeded
    const requestCount = window.timestamps.length;
    const allowed = requestCount < config.maxPerMinute;
    
    if (allowed) {
      window.timestamps.push(now);
    }
    
    const remaining = Math.max(0, config.maxPerMinute - requestCount - (allowed ? 1 : 0));
    const retryAfter = allowed ? undefined : Math.ceil((window.timestamps[0]! - windowStart) / 1000);
    
    return {
      allowed,
      remaining,
      retryAfter,
    };
  }
  
  /**
   * Manually record a request (for testing or manual tracking)
   */
  recordRequest(type: EmailType, scopeId: string): void {
    const key = `${type}:${scopeId}`;
    const now = Date.now();
    
    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = {
        timestamps: [],
        resetAt: now + this.windowDurationMs,
      };
      this.windows.set(key, window);
    }
    
    window.timestamps.push(now);
  }
  
  /**
   * Clear all rate limit data (for testing)
   */
  reset(): void {
    this.windows.clear();
  }
  
  /**
   * Get rate limit config for an email type
   */
  getConfig(type: EmailType): RateLimitConfig {
    return RATE_LIMIT_CONFIGS[type];
  }
  
  /**
   * Clean up old windows (call periodically to prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetAt && window.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }
}

// Singleton instance
const globalRateLimiter = new RateLimiter();

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  return globalRateLimiter;
}

/**
 * Check rate limit for an email
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  return globalRateLimiter.checkLimit(options.type, options.scopeId);
}

/**
 * Execute a function with rate limiting
 * Throws error if rate limit exceeded
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  options: RateLimitOptions
): Promise<T> {
  const result = checkRateLimit(options);
  
  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded for ${options.type}. Retry after ${result.retryAfter} seconds.`,
      result.retryAfter || 60
    );
  }
  
  return fn();
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Check if rate limiting should be applied based on email type
 * Bulk emails might bypass rate limiting in favour of queueing (Phase 2)
 */
export function shouldApplyRateLimit(_type: EmailType): boolean {
  // For Phase 1, apply rate limiting to all types
  // Phase 2 might queue bulk emails instead
  return true;
}
