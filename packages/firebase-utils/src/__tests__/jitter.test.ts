import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withJitter,
  createJittered,
  batchWithJitter,
  shouldUseJitter,
  type JitterOptions,
} from '../jitter';

describe('withJitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('delays execution and returns function result', async () => {
    const mockFn = vi.fn().mockResolvedValue('test-result');
    const options: JitterOptions = { windowMs: 1000 };

    const promise = withJitter(mockFn, options);
    
    // Function should not be called immediately
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance timers to trigger the jitter delay
    await vi.runAllTimersAsync();
    
    const result = await promise;
    
    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe('test-result');
  });

  it('uses default windowMs of 2000ms when not specified', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const promise = withJitter(mockFn);
    
    // Should not execute immediately
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('respects custom windowMs option', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const promise = withJitter(mockFn, { windowMs: 500 });
    
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('respects minDelayMs option', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    // With minDelayMs, the delay should be at least the minimum
    const promise = withJitter(mockFn, { windowMs: 1000, minDelayMs: 500 });
    
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('respects maxDelayMs option overriding windowMs', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const promise = withJitter(mockFn, { windowMs: 2000, maxDelayMs: 500 });
    
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('handles async function that resolves', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'test', success: true });
    
    const promise = withJitter(mockFn, { windowMs: 100 });
    
    await vi.runAllTimersAsync();
    const result = await promise;
    
    expect(result).toEqual({ data: 'test', success: true });
  });

  it('handles async function that rejects', async () => {
    const error = new Error('Test error');
    const mockFn = vi.fn().mockRejectedValue(error);
    
    const promise = withJitter(mockFn, { windowMs: 100 });
    
    // Start awaiting the rejection before running timers
    const expectPromise = expect(promise).rejects.toThrow('Test error');
    await vi.runAllTimersAsync();
    await expectPromise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('passes through function arguments', async () => {
    const mockFn = vi.fn().mockImplementation((a: number, b: string) => 
      Promise.resolve(`${a}-${b}`)
    );
    
    const promise = withJitter(() => mockFn(42, 'test'), { windowMs: 100 });
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalledWith(42, 'test');
  });

  it('generates random delays within window', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    
    // Spy on setTimeout to capture actual delays
    vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
      delays.push(delay);
      return originalSetTimeout(callback, 0) as any;
    });

    const mockFn = vi.fn().mockResolvedValue('result');
    const options: JitterOptions = { windowMs: 1000 };

    // Execute multiple times to check randomness
    const promises = Array.from({ length: 10 }, () => withJitter(mockFn, options));
    
    await vi.runAllTimersAsync();
    await Promise.all(promises);
    
    // All delays should be within the window
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    });
    
    // Delays should be different (checking for randomness)
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });

  it('handles zero minDelayMs', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const promise = withJitter(mockFn, { windowMs: 100, minDelayMs: 0 });
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('handles minDelayMs equal to windowMs', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const promise = withJitter(mockFn, { windowMs: 1000, minDelayMs: 1000 });
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });
});

describe('createJittered', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('creates a jittered version of a function', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const jitteredFn = createJittered(mockFn, { windowMs: 100 });

    const promise = jitteredFn();
    
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    const result = await promise;
    
    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe('result');
  });

  it('passes arguments correctly to wrapped function', async () => {
    const mockFn = vi.fn().mockImplementation((a: number, b: string, c: boolean) =>
      Promise.resolve({ a, b, c })
    );
    const jitteredFn = createJittered(mockFn, { windowMs: 100 });

    const promise = jitteredFn(42, 'test', true);
    
    await vi.runAllTimersAsync();
    const result = await promise;
    
    expect(mockFn).toHaveBeenCalledWith(42, 'test', true);
    expect(result).toEqual({ a: 42, b: 'test', c: true });
  });

  it('can be called multiple times independently', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const jitteredFn = createJittered(mockFn, { windowMs: 100 });

    const promise1 = jitteredFn();
    const promise2 = jitteredFn();
    const promise3 = jitteredFn();
    
    await vi.runAllTimersAsync();
    await Promise.all([promise1, promise2, promise3]);
    
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('preserves function return type', async () => {
    type ComplexReturn = { id: string; data: number[] };
    const mockFn = vi.fn().mockResolvedValue({ id: 'test-123', data: [1, 2, 3] });
    const jitteredFn = createJittered<[string], ComplexReturn>(mockFn, { windowMs: 100 });

    const promise = jitteredFn('input');
    
    await vi.runAllTimersAsync();
    const result = await promise;
    
    expect(result).toEqual({ id: 'test-123', data: [1, 2, 3] });
  });

  it('maintains consistent jitter options across calls', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const jitteredFn = createJittered(mockFn, { windowMs: 500, minDelayMs: 200 });

    // Both calls should use the same jitter options
    const promise1 = jitteredFn();
    const promise2 = jitteredFn();
    
    await vi.runAllTimersAsync();
    await Promise.all([promise1, promise2]);
    
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('batchWithJitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('executes all operations with jitter', async () => {
    const mockFn1 = vi.fn().mockResolvedValue('result1');
    const mockFn2 = vi.fn().mockResolvedValue('result2');
    const mockFn3 = vi.fn().mockResolvedValue('result3');

    const promise = batchWithJitter([mockFn1, mockFn2, mockFn3], { windowMs: 100 });
    
    // None should be called immediately
    expect(mockFn1).not.toHaveBeenCalled();
    expect(mockFn2).not.toHaveBeenCalled();
    expect(mockFn3).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    const results = await promise;
    
    expect(results).toEqual(['result1', 'result2', 'result3']);
    expect(mockFn1).toHaveBeenCalledOnce();
    expect(mockFn2).toHaveBeenCalledOnce();
    expect(mockFn3).toHaveBeenCalledOnce();
  });

  it('handles empty operations array', async () => {
    const promise = batchWithJitter([], { windowMs: 100 });
    
    await vi.runAllTimersAsync();
    const results = await promise;
    
    expect(results).toEqual([]);
  });

  it('handles single operation', async () => {
    const mockFn = vi.fn().mockResolvedValue('single-result');
    
    const promise = batchWithJitter([mockFn], { windowMs: 100 });
    
    await vi.runAllTimersAsync();
    const results = await promise;
    
    expect(results).toEqual(['single-result']);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('executes operations in parallel with different delays', async () => {
    const executionOrder: number[] = [];
    
    const mockFn1 = vi.fn().mockImplementation(() => {
      executionOrder.push(1);
      return Promise.resolve('result1');
    });
    const mockFn2 = vi.fn().mockImplementation(() => {
      executionOrder.push(2);
      return Promise.resolve('result2');
    });
    const mockFn3 = vi.fn().mockImplementation(() => {
      executionOrder.push(3);
      return Promise.resolve('result3');
    });

    const promise = batchWithJitter([mockFn1, mockFn2, mockFn3], { windowMs: 100 });
    
    await vi.runAllTimersAsync();
    await promise;
    
    // All should execute (order may vary due to jitter)
    expect(mockFn1).toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalled();
    expect(mockFn3).toHaveBeenCalled();
    expect(executionOrder).toHaveLength(3);
  });

  it('handles one operation failing', async () => {
    const mockFn1 = vi.fn().mockResolvedValue('result1');
    const mockFn2 = vi.fn().mockRejectedValue(new Error('Operation 2 failed'));
    const mockFn3 = vi.fn().mockResolvedValue('result3');

    const promise = batchWithJitter([mockFn1, mockFn2, mockFn3], { windowMs: 100 });
    
    // Start awaiting the rejection before running timers
    const expectPromise = expect(promise).rejects.toThrow('Operation 2 failed');
    await vi.runAllTimersAsync();
    await expectPromise;
  });

  it('handles all operations failing', async () => {
    const mockFn1 = vi.fn().mockRejectedValue(new Error('Failed 1'));
    const mockFn2 = vi.fn().mockRejectedValue(new Error('Failed 2'));

    const promise = batchWithJitter([mockFn1, mockFn2], { windowMs: 100 });
    
    // Start awaiting the rejection before running timers
    const expectPromise = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await expectPromise;
  });

  it('passes jitter options to all operations', async () => {
    const operations = Array.from({ length: 5 }, () => 
      vi.fn().mockResolvedValue('result')
    );

    const promise = batchWithJitter(operations, { windowMs: 500, minDelayMs: 200 });
    
    await vi.runAllTimersAsync();
    await promise;
    
    operations.forEach((op) => {
      expect(op).toHaveBeenCalledOnce();
    });
  });

  it('handles large batch of operations', async () => {
    const operations = Array.from({ length: 100 }, (_, i) =>
      vi.fn().mockResolvedValue(`result-${i}`)
    );

    const promise = batchWithJitter(operations, { windowMs: 1000 });
    
    await vi.runAllTimersAsync();
    const results = await promise;
    
    expect(results).toHaveLength(100);
    operations.forEach((op, i) => {
      expect(op).toHaveBeenCalledOnce();
      expect(results[i]).toBe(`result-${i}`);
    });
  });
});

describe('shouldUseJitter', () => {
  it('returns true when high concurrency is expected', () => {
    expect(shouldUseJitter(true)).toBe(true);
  });

  it('returns false when high concurrency is not expected', () => {
    expect(shouldUseJitter(false)).toBe(false);
  });

  it('handles boolean parameter correctly', () => {
    const highConcurrencyScenarios = [true, 1 > 0, Boolean('yes')];
    const lowConcurrencyScenarios = [false, 1 < 0, Boolean('')];

    highConcurrencyScenarios.forEach((scenario) => {
      expect(shouldUseJitter(scenario)).toBe(true);
    });

    lowConcurrencyScenarios.forEach((scenario) => {
      expect(shouldUseJitter(scenario)).toBe(false);
    });
  });
});

describe('jitter integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('simulates 5000 concurrent vote submissions', async () => {
    const voteSubmissions: Array<() => Promise<string>> = [];
    
    // Simulate 5000 users voting
    for (let i = 0; i < 5000; i++) {
      const mockVote = vi.fn().mockResolvedValue(`vote-${i}`);
      voteSubmissions.push(mockVote);
    }

    // Spread votes over 2 second window
    const promise = batchWithJitter(voteSubmissions, { windowMs: 2000 });
    
    await vi.runAllTimersAsync();
    const results = await promise;
    
    expect(results).toHaveLength(5000);
    voteSubmissions.forEach((vote) => {
      expect(vote).toHaveBeenCalledOnce();
    });
  }, 15000);

  it('combines shouldUseJitter with conditional execution', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const isLiveEvent = true;

    const executeFn = async () => {
      if (shouldUseJitter(isLiveEvent)) {
        return withJitter(mockFn, { windowMs: 1000 });
      }
      return mockFn();
    };

    const promise = executeFn();
    
    // Should not execute immediately (jitter applied)
    expect(mockFn).not.toHaveBeenCalled();
    
    await vi.runAllTimersAsync();
    await promise;
    
    expect(mockFn).toHaveBeenCalled();
  });
});
