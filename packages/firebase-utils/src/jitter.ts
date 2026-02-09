/**
 * Jitter Utility for Concurrent Write Protection
 * 
 * Firestore has a hard limit of ~500 writes/second per collection.
 * When 5,000+ users interact simultaneously (e.g., "Vote Now!" moment),
 * we need to spread writes over time to prevent saturation.
 * 
 * Jitter adds a random delay before executing operations, distributing
 * load across a time window instead of all at once.
 * 
 * ALWAYS use this for audience-facing write operations.
 */

export interface JitterOptions {
  /**
   * Time window in milliseconds to distribute writes across
   * Default: 2000ms (2 seconds)
   * 
   * Example: 5000 writes over 2000ms = ~2500 writes/sec → spread to ~500/sec
   */
  windowMs?: number;

  /**
   * Minimum delay in milliseconds (prevents instant execution)
   * Default: 0ms
   */
  minDelayMs?: number;

  /**
   * Maximum delay in milliseconds (caps the jitter)
   * Overrides windowMs if set
   * Default: windowMs value
   */
  maxDelayMs?: number;
}

/**
 * Generate a random delay within the specified window
 * 
 * @param options - Jitter configuration options
 * @returns Random delay in milliseconds
 */
function calculateJitter(options: JitterOptions = {}): number {
  const { windowMs = 2000, minDelayMs = 0, maxDelayMs } = options;
  const max = maxDelayMs ?? windowMs;
  
  // Generate random delay between min and max
  const delay = minDelayMs + Math.random() * (max - minDelayMs);
  
  return Math.floor(delay);
}

/**
 * Execute a function after a random jitter delay
 * 
 * Use this for all write operations during high-concurrency scenarios:
 * - Submitting questions in Q&A
 * - Casting votes
 * - Sending reactions
 * - Any audience-initiated Firestore write
 * 
 * @param fn - Async function to execute after jitter delay
 * @param options - Jitter configuration options
 * @returns Promise that resolves with the function's return value
 * 
 * @example
 * ```ts
 * // Submit a question with jitter (spreads 5000 writes over 2 seconds)
 * await withJitter(
 *   () => addDoc(collection(db, 'questions'), questionData),
 *   { windowMs: 2000 }
 * );
 * ```
 * 
 * @example
 * ```ts
 * // Vote with optimistic UI update
 * const optimisticVote = { ...vote, isPending: true };
 * setLocalVote(optimisticVote);
 * 
 * await withJitter(
 *   () => updateDoc(voteRef, { count: increment(1) }),
 *   { windowMs: 2000 }
 * );
 * 
 * setLocalVote({ ...optimisticVote, isPending: false });
 * ```
 */
export async function withJitter<T>(
  fn: () => Promise<T>,
  options?: JitterOptions
): Promise<T> {
  const delay = calculateJitter(options);
  
  // Wait for the jitter delay
  await new Promise((resolve) => setTimeout(resolve, delay));
  
  // Execute the function
  return fn();
}

/**
 * Create a jittered version of a function
 * Useful for creating reusable jittered operations
 * 
 * @param fn - Function to wrap with jitter
 * @param options - Jitter configuration options
 * @returns Jittered version of the function
 * 
 * @example
 * ```ts
 * const submitQuestionWithJitter = createJittered(
 *   (data: QuestionData) => addDoc(collection(db, 'questions'), data),
 *   { windowMs: 2000 }
 * );
 * 
 * // Use anywhere without repeating jitter config
 * await submitQuestionWithJitter(questionData);
 * ```
 */
export function createJittered<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: JitterOptions
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    return withJitter(() => fn(...args), options);
  };
}

/**
 * Batch execute multiple operations with jitter
 * Each operation gets its own random delay
 * 
 * @param operations - Array of async functions to execute
 * @param options - Jitter configuration options
 * @returns Promise that resolves when all operations complete
 * 
 * @example
 * ```ts
 * // Submit multiple reactions simultaneously with jitter
 * await batchWithJitter([
 *   () => addDoc(collection(db, 'reactions'), reaction1),
 *   () => addDoc(collection(db, 'reactions'), reaction2),
 *   () => addDoc(collection(db, 'reactions'), reaction3),
 * ], { windowMs: 2000 });
 * ```
 */
export async function batchWithJitter<T>(
  operations: Array<() => Promise<T>>,
  options?: JitterOptions
): Promise<T[]> {
  // Execute all operations with jitter in parallel
  return Promise.all(operations.map((op) => withJitter(op, options)));
}

/**
 * Helper to determine if jitter should be used based on context
 * Use this to conditionally apply jitter in shared code
 * 
 * @param isHighConcurrency - Whether high concurrency is expected
 * @returns Whether to apply jitter
 * 
 * @example
 * ```ts
 * async function submitVote(voteData: Vote, isLiveEvent: boolean) {
 *   const writeFn = () => addDoc(collection(db, 'votes'), voteData);
 *   
 *   if (shouldUseJitter(isLiveEvent)) {
 *     return withJitter(writeFn);
 *   }
 *   
 *   return writeFn();
 * }
 * ```
 */
export function shouldUseJitter(isHighConcurrency: boolean): boolean {
  return isHighConcurrency;
}
