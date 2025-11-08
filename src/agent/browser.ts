/**
 * Browser initialization and page loading
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { AsyncLocalStorage } from 'async_hooks';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { retry, PAGE_LOAD_RETRY } from '../utils/retry.js';
import { BrowserError, PageLoadTimeoutError } from '../utils/errors.js';

// Use AsyncLocalStorage to support parallel test execution
// Each async context gets its own browser instance ID
export const browserStorage = new AsyncLocalStorage<string>();

// Map to store browser instances keyed by test ID
const browserInstances = new Map<string, Stagehand>();

// Fallback to global for backward compatibility (single test mode)
let stagehandInstance: Stagehand | null = null;

/**
 * Initialize Stagehand browser with Browserbase
 * Stores the instance in the current async context for parallel execution support
 */
export async function initBrowser(): Promise<Stagehand> {
  const config = getConfig();

  logger.info('Initializing browser', {
    provider: 'browserbase',
    projectId: config.browserbaseProjectId,
  });

  try {
    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: config.browserbaseApiKey,
      projectId: config.browserbaseProjectId,
      enableCaching: false,
      verbose: 0,
    });

    await stagehand.init();

    // Store in async context if we're in one (created by browserStorage.run())
    const testId = browserStorage.getStore();
    if (testId !== undefined) {
      // We're in an async context - store the instance in the Map
      browserInstances.set(testId, stagehand);
    } else {
      // Not in an async context, use global (backward compatibility)
      stagehandInstance = stagehand;
    }

    logger.info('Browser initialized successfully');
    return stagehand;
  } catch (error) {
    logger.error('Failed to initialize browser', error as Error);
    throw new BrowserError('Failed to initialize browser');
  }
}

/**
 * Get current Stagehand instance
 * Checks async context first (for parallel execution), then falls back to global
 */
export function getBrowser(): Stagehand {
  // First check async context (for parallel execution)
  const testId = browserStorage.getStore();
  if (testId !== undefined) {
    const instance = browserInstances.get(testId);
    if (instance) {
      return instance;
    }
    throw new BrowserError(`Browser not initialized for test ${testId}. Call initBrowser() first.`);
  }
  
  // Fallback to global (for backward compatibility)
  if (!stagehandInstance) {
    throw new BrowserError('Browser not initialized. Call initBrowser() first.');
  }
  return stagehandInstance;
}

/**
 * Check if page is ready (DOM loaded and network idle)
 */
async function waitForPageReady(stagehand: Stagehand, timeout: number): Promise<void> {
  const startTime = Date.now();

  logger.debug('Waiting for page to be ready', { timeout });

  try {
    // Wait for the page to be in a stable state
    await stagehand.page.waitForLoadState('domcontentloaded', {
      timeout,
    });

    logger.debug('DOM content loaded');

    // Wait for network to be mostly idle
    await stagehand.page.waitForLoadState('networkidle', {
      timeout: Math.min(timeout - (Date.now() - startTime), 5000),
    });

    logger.debug('Network idle');
  } catch (error) {
    logger.warn('Page ready check timed out, proceeding anyway');
    // Continue anyway - some games may have continuous network activity
  }
}

/**
 * Load a game URL with retry logic
 *
 * @param url - Game URL to load
 * @returns Promise that resolves when page is loaded
 */
export async function loadGame(url: string): Promise<void> {
  const config = getConfig();
  const stagehand = getBrowser();

  logger.info('Loading game', { url });

  const loadOperation = async () => {
    try {
      const startTime = Date.now();

      // Navigate to the game URL
      await stagehand.page.goto(url, {
        timeout: config.timeoutPageLoad,
        waitUntil: 'domcontentloaded',
      });

      // Wait for page to be ready
      await waitForPageReady(stagehand, config.timeoutPageLoad);

      const loadTime = Date.now() - startTime;
      logger.info('Game loaded successfully', { url, loadTime });
    } catch (error) {
      const err = error as Error;
      logger.warn('Game load attempt failed', { url, error: err.message });

      if (err.message.includes('Timeout') || err.message.includes('timeout')) {
        throw new PageLoadTimeoutError(url, config.timeoutPageLoad);
      }

      throw new BrowserError(`Failed to load game: ${err.message}`, url);
    }
  };

  // Retry the load operation
  await retry(loadOperation, {
    ...PAGE_LOAD_RETRY,
    maxAttempts: config.retryAttempts,
    onRetry: (error, attempt) => {
      logger.info(`Retrying game load (attempt ${attempt})`, {
        url,
        error: error.message,
      });
    },
  });
}

/**
 * Get the current page URL
 */
export async function getCurrentUrl(): Promise<string> {
  const stagehand = getBrowser();
  return stagehand.page.url();
}

/**
 * Get page title
 */
export async function getPageTitle(): Promise<string> {
  const stagehand = getBrowser();
  return stagehand.page.title();
}

/**
 * Execute JavaScript in the page context
 */
export async function evaluateInPage<T>(script: string | (() => T)): Promise<T> {
  const stagehand = getBrowser();
  return stagehand.page.evaluate(script);
}

/**
 * Check if page has crashed or is unresponsive
 */
export async function isPageResponsive(): Promise<boolean> {
  try {
    const stagehand = getBrowser();

    // Try to get a simple property from the page
    const isVisible = await stagehand.page.evaluate(() => {
      return document.visibilityState === 'visible';
    });

    return isVisible;
  } catch (error) {
    logger.error('Page responsiveness check failed', error as Error);
    return false;
  }
}

/**
 * Get viewport dimensions
 */
export async function getViewportSize(): Promise<{ width: number; height: number }> {
  const stagehand = getBrowser();
  const viewport = stagehand.page.viewportSize();
  return viewport || { width: 1280, height: 720 };
}

/**
 * Set viewport size
 */
export async function setViewportSize(width: number, height: number): Promise<void> {
  const stagehand = getBrowser();
  await stagehand.page.setViewportSize({ width, height });
  logger.debug('Viewport size set', { width, height });
}

/**
 * Close the browser and cleanup
 */
export async function closeBrowser(): Promise<void> {
  // Get the instance from async context or global
  const testId = browserStorage.getStore();
  let instance: Stagehand | null = null;
  
  if (testId !== undefined) {
    // We're in an async context - get instance from Map
    instance = browserInstances.get(testId) || null;
    if (instance) {
      browserInstances.delete(testId);
    }
  } else {
    // Use global
    instance = stagehandInstance;
    stagehandInstance = null;
  }
  
  if (!instance) {
    return;
  }

  logger.info('Closing browser');

  try {
    await instance.close();
    logger.info('Browser closed successfully');
  } catch (error) {
    logger.error('Error closing browser', error as Error);
  }
}

/**
 * Get browser info for metadata
 */
export function getBrowserInfo(): string {
  return 'Chromium (via Browserbase)';
}

