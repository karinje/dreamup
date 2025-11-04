/**
 * Structured logging utility
 */

import { LogLevel } from '../types/index.js';

/**
 * Log entry structure
 */
interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Logger class for structured logging
 */
class Logger {
  private logLevel: LogLevel;
  private logHistory: LogData[] = [];

  constructor(logLevel: LogLevel = 'info') {
    this.logLevel = logLevel;
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Format and output log entry
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
    };

    this.logHistory.push(logEntry);

    // Output to console
    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const logEntry: LogData = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };

    this.logHistory.push(logEntry);

    console.error(JSON.stringify(logEntry));
  }

  /**
   * Get all logged entries
   */
  getHistory(): LogData[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    debug: number;
    info: number;
    warn: number;
    error: number;
  } {
    const stats = {
      total: this.logHistory.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    for (const entry of this.logHistory) {
      stats[entry.level]++;
    }

    return stats;
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Initialize logger with log level from config
 */
export function initLogger(logLevel: LogLevel): void {
  logger.setLogLevel(logLevel);
}

/**
 * Export logger class for custom instances if needed
 */
export { Logger };

