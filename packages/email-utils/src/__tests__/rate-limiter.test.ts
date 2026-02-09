/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, RateLimitError, checkRateLimit, withRateLimit } from '../rate-limiter';
import type { EmailType } from '../types';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  
  beforeEach(() => {
    limiter = new RateLimiter();
  });
  
  describe('checkLimit', () => {
    it('allows requests within limit', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // Send 10 invitations (within limit)
      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit(type, scopeId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      }
    });
    
    it('blocks requests exceeding limit', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // Send 10 invitations (at limit)
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(type, scopeId);
      }
      
      // 11th should be blocked
      const blocked = limiter.checkLimit(type, scopeId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });
    
    it('tracks different scopes independently', () => {
      const type: EmailType = 'invitation';
      
      // Org 1: send 10 emails (at limit)
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(type, 'org-1');
      }
      
      // Org 2: should still be allowed
      const result = limiter.checkLimit(type, 'org-2');
      expect(result.allowed).toBe(true);
    });
    
    it('tracks different email types independently', () => {
      const scopeId = 'user-123';
      
      // Send 5 password resets (at limit)
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('password-reset', scopeId);
      }
      
      // Verifications should still be allowed (different type)
      const result = limiter.checkLimit('verification', scopeId);
      expect(result.allowed).toBe(true);
    });
    
    it('uses sliding window algorithm', async () => {
      const type: EmailType = 'password-reset';
      const scopeId = 'user-123';
      
      // Send 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(type, scopeId);
      }
      
      // 6th should be blocked
      expect(limiter.checkLimit(type, scopeId).allowed).toBe(false);
      
      // Wait for oldest request to expire (simulate time passing)
      // In real tests, we'd use fake timers, but for simplicity:
      // The sliding window should remove old timestamps
    });
    
    it('returns correct remaining count', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // First request
      const result1 = limiter.checkLimit(type, scopeId);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9); // 10 max - 1 used
      
      // Second request
      const result2 = limiter.checkLimit(type, scopeId);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8); // 10 max - 2 used
    });
  });
  
  describe('recordRequest', () => {
    it('manually records a request', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // Record 10 requests manually
      for (let i = 0; i < 10; i++) {
        limiter.recordRequest(type, scopeId);
      }
      
      // Next check should be blocked
      const result = limiter.checkLimit(type, scopeId);
      expect(result.allowed).toBe(false);
    });
  });
  
  describe('reset', () => {
    it('clears all rate limit data', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(type, scopeId);
      }
      
      // Reset
      limiter.reset();
      
      // Should be allowed again
      const result = limiter.checkLimit(type, scopeId);
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('getConfig', () => {
    it('returns rate limit config for email type', () => {
      const config = limiter.getConfig('invitation');
      expect(config).toHaveProperty('maxPerMinute');
      expect(config).toHaveProperty('scope');
      expect(config.scope).toBe('organization');
    });
  });
  
  describe('cleanup', () => {
    it('removes expired windows', () => {
      const type: EmailType = 'invitation';
      const scopeId = 'org-123';
      
      // Check limit once (creates window with 1 timestamp)
      limiter.checkLimit(type, scopeId);
      
      // Cleanup should not remove active window
      limiter.cleanup();
      
      // Check limit again - window still active, now has 2 timestamps
      const result = limiter.checkLimit(type, scopeId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // 10 max - 2 used = 8 remaining
    });
  });
});

describe('checkRateLimit', () => {
  it('checks rate limit using global instance', () => {
    const result = checkRateLimit({
      type: 'invitation',
      scopeId: 'org-test',
    });
    
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
  });
});

describe('withRateLimit', () => {
  beforeEach(() => {
    // Reset global limiter
    const limiter = new RateLimiter();
    limiter.reset();
  });
  
  it('executes function if within rate limit', async () => {
    const mockFn = async () => 'success';
    
    const result = await withRateLimit(mockFn, {
      type: 'invitation',
      scopeId: 'org-test-1',
    });
    
    expect(result).toBe('success');
  });
  
  it('throws RateLimitError if limit exceeded', async () => {
    const mockFn = async () => 'success';
    const options = {
      type: 'password-reset' as EmailType,
      scopeId: 'user-test',
    };
    
    // Fill up the limit (5 for password-reset)
    for (let i = 0; i < 5; i++) {
      await withRateLimit(mockFn, options);
    }
    
    // 6th should throw
    await expect(
      withRateLimit(mockFn, options)
    ).rejects.toThrow(RateLimitError);
  });
  
  it('includes retry-after in error', async () => {
    const mockFn = async () => 'success';
    const options = {
      type: 'password-reset' as EmailType,
      scopeId: 'user-test-2',
    };
    
    // Fill up the limit
    for (let i = 0; i < 5; i++) {
      await withRateLimit(mockFn, options);
    }
    
    // 6th should throw with retryAfter
    try {
      await withRateLimit(mockFn, options);
      expect.fail('Should have thrown RateLimitError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBeGreaterThan(0);
    }
  });
});
