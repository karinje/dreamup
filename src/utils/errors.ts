/**
 * Custom error classes for the QA agent
 */

/**
 * Base error class for all QA agent errors
 */
export class QAAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QAAgentError';
    Object.setPrototypeOf(this, QAAgentError.prototype);
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends QAAgentError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Browser automation errors
 */
export class BrowserError extends QAAgentError {
  constructor(message: string, public readonly url?: string) {
    super(message);
    this.name = 'BrowserError';
    Object.setPrototypeOf(this, BrowserError.prototype);
  }
}

/**
 * Page load timeout error
 */
export class PageLoadTimeoutError extends BrowserError {
  constructor(url: string, timeout: number) {
    super(`Page failed to load within ${timeout}ms: ${url}`, url);
    this.name = 'PageLoadTimeoutError';
    Object.setPrototypeOf(this, PageLoadTimeoutError.prototype);
  }
}

/**
 * Navigation errors
 */
export class NavigationError extends QAAgentError {
  constructor(message: string) {
    super(message);
    this.name = 'NavigationError';
    Object.setPrototypeOf(this, NavigationError.prototype);
  }
}

/**
 * Interaction errors (clicking, typing, etc.)
 */
export class InteractionError extends QAAgentError {
  constructor(message: string, public readonly action?: string) {
    super(message);
    this.name = 'InteractionError';
    Object.setPrototypeOf(this, InteractionError.prototype);
  }
}

/**
 * Element not found error
 */
export class ElementNotFoundError extends InteractionError {
  constructor(selector: string) {
    super(`Element not found: ${selector}`);
    this.name = 'ElementNotFoundError';
    Object.setPrototypeOf(this, ElementNotFoundError.prototype);
  }
}

/**
 * Screenshot capture errors
 */
export class ScreenshotError extends QAAgentError {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenshotError';
    Object.setPrototypeOf(this, ScreenshotError.prototype);
  }
}

/**
 * LLM evaluation errors
 */
export class EvaluationError extends QAAgentError {
  constructor(message: string, public readonly provider?: string) {
    super(message);
    this.name = 'EvaluationError';
    Object.setPrototypeOf(this, EvaluationError.prototype);
  }
}

/**
 * Timeout error for overall test execution
 */
export class ExecutionTimeoutError extends QAAgentError {
  constructor(timeout: number) {
    super(`Test execution exceeded maximum time of ${timeout}ms`);
    this.name = 'ExecutionTimeoutError';
    Object.setPrototypeOf(this, ExecutionTimeoutError.prototype);
  }
}

/**
 * File system errors
 */
export class FileSystemError extends QAAgentError {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends QAAgentError {
  constructor(operation: string, attempts: number) {
    super(`Retry exhausted for operation "${operation}" after ${attempts} attempts`);
    this.name = 'RetryExhaustedError';
    Object.setPrototypeOf(this, RetryExhaustedError.prototype);
  }
}

/**
 * Game crashed/froze error
 */
export class GameCrashError extends QAAgentError {
  constructor(message: string) {
    super(message);
    this.name = 'GameCrashError';
    Object.setPrototypeOf(this, GameCrashError.prototype);
  }
}

/**
 * Check if error is a known QA agent error
 */
export function isQAAgentError(error: unknown): error is QAAgentError {
  return error instanceof QAAgentError;
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

