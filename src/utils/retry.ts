/**
 * Retry logic utility with exponential backoff
 */

import { logger } from './logger.js';
import { RetryExhaustedError } from './errors.js';

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the operation if successful
 * @throws RetryExhaustedError if all attempts fail
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug(`Attempting operation (attempt ${attempt}/${opts.maxAttempts})`);
      const result = await operation();
      if (attempt > 1) {
        logger.info(`Operation succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(`Operation failed on attempt ${attempt}/${opts.maxAttempts}`, {
        error: lastError.message,
      });

      if (options.onRetry) {
        options.onRetry(lastError, attempt);
      }

      if (attempt < opts.maxAttempts) {
        const delay = calculateDelay(
          attempt,
          opts.initialDelay,
          opts.maxDelay,
          opts.backoffFactor
        );
        logger.debug(`Retrying after ${delay}ms delay`);
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  const operationName = operation.name || 'anonymous operation';
  throw new RetryExhaustedError(operationName, opts.maxAttempts);
}

/**
 * Retry with a specific error type filter
 * Only retries if the error matches the filter
 */
export async function retryOnError<T>(
  operation: () => Promise<T>,
  errorFilter: (error: Error) => boolean,
  options: RetryOptions
): Promise<T> {
  const wrappedOperation = async (): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!errorFilter(err)) {
        // Don't retry this error, throw immediately
        throw error;
      }
      throw error;
    }
  };

  return retry(wrappedOperation, options);
}

/**
 * Retry configuration for page loads
 */
export const PAGE_LOAD_RETRY: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 2000,
  maxDelay: 8000,
  backoffFactor: 2,
};

/**
 * Retry configuration for element interactions
 */
export const INTERACTION_RETRY: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 2000,
  backoffFactor: 2,
};

/**
 * Retry configuration for screenshots
 */
export const SCREENSHOT_RETRY: RetryOptions = {
  maxAttempts: 2,
  initialDelay: 1000,
  maxDelay: 3000,
  backoffFactor: 2,
};

