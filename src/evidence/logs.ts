/**
 * Console log collection
 */

import * as path from 'path';
import { Page } from 'playwright';
import { getBrowser } from '../agent/browser.js';
import { logger } from '../utils/logger.js';
import { LogEntry } from '../types/index.js';
import { saveJSON } from './storage.js';

let consoleLogCollector: LogEntry[] = [];
let networkErrors: LogEntry[] = [];

/**
 * Setup console log listeners for the page
 */
export function setupLogListeners(): void {
  const stagehand = getBrowser();
  const page: Page = stagehand.page;

  logger.info('Setting up console log listeners');

  // Clear any existing logs
  consoleLogCollector = [];
  networkErrors = [];

  // Listen to console messages
  page.on('console', (msg) => {
    const entry: LogEntry = {
      level: msg.type() as 'log' | 'info' | 'warn' | 'error',
      message: msg.text(),
      timestamp: new Date().toISOString(),
      url: msg.location().url,
      lineNumber: msg.location().lineNumber,
      columnNumber: msg.location().columnNumber,
    };

    consoleLogCollector.push(entry);

    logger.debug('Console message captured', {
      type: msg.type(),
      message: msg.text().substring(0, 100),
    });
  });

  // Listen to page errors
  page.on('pageerror', (error) => {
    const entry: LogEntry = {
      level: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    consoleLogCollector.push(entry);

    logger.warn('Page error captured', {
      message: error.message.substring(0, 100),
    });
  });

  // Listen to request failures
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const entry: LogEntry = {
      level: 'error',
      message: `Request failed: ${request.url()} - ${failure?.errorText || 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      url: request.url(),
    };

    networkErrors.push(entry);

    logger.debug('Network request failed', {
      url: request.url(),
      error: failure?.errorText,
    });
  });

  // Listen to response errors (4xx, 5xx)
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const entry: LogEntry = {
        level: 'error',
        message: `HTTP ${response.status()}: ${response.url()}`,
        timestamp: new Date().toISOString(),
        url: response.url(),
      };

      networkErrors.push(entry);

      logger.debug('HTTP error response', {
        status: response.status(),
        url: response.url(),
      });
    }
  });

  logger.info('Log listeners setup complete');
}

/**
 * Get all collected console logs
 */
export function getConsoleLogs(): LogEntry[] {
  return [...consoleLogCollector];
}

/**
 * Get network errors
 */
export function getNetworkErrors(): LogEntry[] {
  return [...networkErrors];
}

/**
 * Get all logs (console + network)
 */
export function getAllLogs(): LogEntry[] {
  return [...consoleLogCollector, ...networkErrors];
}

/**
 * Get error logs only
 */
export function getErrorLogs(): LogEntry[] {
  return getAllLogs().filter((log) => log.level === 'error');
}

/**
 * Get warning logs only
 */
export function getWarningLogs(): LogEntry[] {
  return getAllLogs().filter((log) => log.level === 'warn');
}

/**
 * Check if there are any errors
 */
export function hasErrors(): boolean {
  return getErrorLogs().length > 0;
}

/**
 * Get error count
 */
export function getErrorCount(): number {
  return getErrorLogs().length;
}

/**
 * Get warning count
 */
export function getWarningCount(): number {
  return getWarningLogs().length;
}

/**
 * Save logs to file
 */
export async function saveLogs(sessionDir: string): Promise<string> {
  const logsPath = path.join(sessionDir, 'logs', 'console-logs.json');

  const logsData = {
    consoleLogs: consoleLogCollector,
    networkErrors: networkErrors,
    summary: {
      totalLogs: consoleLogCollector.length,
      totalNetworkErrors: networkErrors.length,
      errorCount: getErrorCount(),
      warningCount: getWarningCount(),
    },
  };

  await saveJSON(logsPath, logsData);

  logger.info('Logs saved', {
    path: logsPath,
    totalLogs: logsData.summary.totalLogs,
    errors: logsData.summary.errorCount,
  });

  return logsPath;
}

/**
 * Clear all collected logs
 */
export function clearLogs(): void {
  consoleLogCollector = [];
  networkErrors = [];
  logger.debug('Logs cleared');
}

/**
 * Get logs summary
 */
export function getLogsSummary(): {
  total: number;
  errors: number;
  warnings: number;
  networkErrors: number;
} {
  return {
    total: consoleLogCollector.length,
    errors: getErrorCount(),
    warnings: getWarningCount(),
    networkErrors: networkErrors.length,
  };
}

/**
 * Format logs for LLM analysis (truncate if too many)
 */
export function formatLogsForLLM(maxLogs: number = 50): LogEntry[] {
  const allLogs = getAllLogs();

  if (allLogs.length <= maxLogs) {
    return allLogs;
  }

  // Prioritize errors and warnings
  const errors = allLogs.filter((log) => log.level === 'error');
  const warnings = allLogs.filter((log) => log.level === 'warn');
  const others = allLogs.filter((log) => log.level !== 'error' && log.level !== 'warn');

  const result: LogEntry[] = [];

  // Add all errors
  result.push(...errors);

  // Add warnings if space
  const remaining = maxLogs - result.length;
  if (remaining > 0) {
    result.push(...warnings.slice(0, Math.floor(remaining / 2)));
  }

  // Add other logs if space
  const finalRemaining = maxLogs - result.length;
  if (finalRemaining > 0) {
    result.push(...others.slice(0, finalRemaining));
  }

  return result;
}

