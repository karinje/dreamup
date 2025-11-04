/**
 * UI detection and interaction logic
 */

import { getBrowser } from './browser.js';
import { logger } from '../utils/logger.js';
import { retry, INTERACTION_RETRY } from '../utils/retry.js';
import { InteractionError } from '../utils/errors.js';

/**
 * Common button text patterns for start/play buttons
 */
const START_BUTTON_PATTERNS = [
  'start',
  'play',
  'begin',
  'start game',
  'play game',
  'play now',
  'click to start',
  'tap to start',
  'press start',
  'new game',
  'continue',
];

/**
 * Common game over screen patterns
 */
const GAME_OVER_PATTERNS = [
  'game over',
  'you died',
  'you lost',
  'try again',
  'play again',
  'restart',
  'you win',
  'victory',
  'congratulations',
  'level complete',
  'stage clear',
];

/**
 * Find and click start/play button
 */
export async function clickStartButton(): Promise<boolean> {
  logger.info('Looking for start/play button');

  const clickOperation = async (): Promise<boolean> => {
    try {
      const stagehand = getBrowser();

      // Try to find and click a start button using Stagehand's act
      for (const pattern of START_BUTTON_PATTERNS) {
        try {
          logger.debug('Trying to find button with text', { pattern });

          await stagehand.act({
            action: `click on the button that says "${pattern}"`,
          });

          logger.info('Successfully clicked start button', { pattern });
          return true;
        } catch (error) {
          // Continue to next pattern
          continue;
        }
      }

      // If Stagehand approach didn't work, try direct selector approach
      const buttonSelectors = [
        'button:has-text("Start")',
        'button:has-text("Play")',
        '[id*="start"]',
        '[id*="play"]',
        '[class*="start"]',
        '[class*="play"]',
        'button.start',
        'button.play',
        '#start',
        '#play',
      ];

      for (const selector of buttonSelectors) {
        try {
          const element = await stagehand.page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            await element.click();
            logger.info('Clicked start button via selector', { selector });
            return true;
          }
        } catch {
          continue;
        }
      }

      logger.warn('No start button found');
      return false;
    } catch (error) {
      const err = error as Error;
      logger.error('Error clicking start button', err);
      throw new InteractionError(`Failed to click start button: ${err.message}`, 'clickStart');
    }
  };

  try {
    return await retry(clickOperation, INTERACTION_RETRY);
  } catch {
    return false;
  }
}

/**
 * Detect if we're on a game over screen
 */
export async function detectGameOver(): Promise<boolean> {
  try {
    const stagehand = getBrowser();
    const pageText = await stagehand.page.textContent('body');

    if (!pageText) return false;

    const lowerText = pageText.toLowerCase();

    for (const pattern of GAME_OVER_PATTERNS) {
      if (lowerText.includes(pattern)) {
        logger.info('Game over screen detected', { pattern });
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.warn('Error detecting game over', { error: (error as Error).message });
    return false;
  }
}

/**
 * Simulate keyboard input
 */
export async function pressKey(key: string, holdMs?: number): Promise<void> {
  try {
    const stagehand = getBrowser();

    logger.debug('Pressing key', { key, holdMs });

    await stagehand.page.keyboard.down(key);

    if (holdMs) {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
    }

    await stagehand.page.keyboard.up(key);

    logger.debug('Key pressed successfully', { key });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to press key', err, { key });
    throw new InteractionError(`Failed to press key: ${err.message}`, `pressKey-${key}`);
  }
}

/**
 * Simulate a sequence of key presses (for gameplay)
 */
export async function pressKeySequence(keys: string[], delayMs: number = 500): Promise<void> {
  logger.debug('Pressing key sequence', { keys, delayMs });

  for (const key of keys) {
    await pressKey(key);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

/**
 * Simulate common game controls (arrow keys, WASD, spacebar)
 */
export async function simulateGameplayInput(durationMs: number = 5000): Promise<void> {
  logger.info('Simulating gameplay input', { durationMs });

  const startTime = Date.now();
  const commonKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'w', 'a', 's', 'd'];

  try {
    while (Date.now() - startTime < durationMs) {
      // Pick random key
      const key = commonKeys[Math.floor(Math.random() * commonKeys.length)];

      await pressKey(key, 200);

      // Random delay between inputs
      const delay = Math.random() * 500 + 300; // 300-800ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    logger.info('Gameplay simulation complete');
  } catch (error) {
    logger.warn('Gameplay simulation interrupted', { error: (error as Error).message });
  }
}

/**
 * Click at specific coordinates
 */
export async function clickAtCoordinates(x: number, y: number): Promise<void> {
  try {
    const stagehand = getBrowser();

    logger.debug('Clicking at coordinates', { x, y });

    await stagehand.page.mouse.click(x, y);

    logger.debug('Click successful', { x, y });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to click at coordinates', err, { x, y });
    throw new InteractionError(`Failed to click: ${err.message}`, `click-${x},${y}`);
  }
}

/**
 * Click in the center of the viewport (common for click-to-interact games)
 */
export async function clickCenter(): Promise<void> {
  try {
    const stagehand = getBrowser();
    const viewport = stagehand.page.viewportSize();

    if (!viewport) {
      logger.warn('Viewport size not available, using defaults');
      await clickAtCoordinates(640, 360);
      return;
    }

    const x = viewport.width / 2;
    const y = viewport.height / 2;

    logger.info('Clicking center of viewport', { x, y });
    await clickAtCoordinates(x, y);
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to click center', err);
    throw new InteractionError(`Failed to click center: ${err.message}`, 'clickCenter');
  }
}

/**
 * Perform random clicks across the viewport (exploration)
 */
export async function performRandomClicks(count: number = 5, delayMs: number = 1000): Promise<void> {
  logger.info('Performing random clicks', { count, delayMs });

  const stagehand = getBrowser();
  const viewport = stagehand.page.viewportSize() || { width: 1280, height: 720 };

  for (let i = 0; i < count; i++) {
    try {
      const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1; // Avoid edges
      const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;

      await clickAtCoordinates(x, y);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      logger.warn('Random click failed', { index: i });
    }
  }
}

/**
 * Detect available controls by checking for keyboard event listeners
 */
export async function detectControls(): Promise<string[]> {
  try {
    const stagehand = getBrowser();

    const hasKeyboardListeners = await stagehand.page.evaluate(() => {
      // Check if there are keyboard event listeners
      return (
        document.onkeydown !== null ||
        document.onkeyup !== null ||
        document.onkeypress !== null
      );
    });

    const controls: string[] = [];

    if (hasKeyboardListeners) {
      controls.push('keyboard');
      logger.info('Keyboard controls detected');
    }

    // Always assume mouse is available for browser games
    controls.push('mouse');

    logger.info('Controls detected', { controls });
    return controls;
  } catch (error) {
    logger.warn('Error detecting controls', { error: (error as Error).message });
    return ['mouse', 'keyboard']; // Default assumption
  }
}

/**
 * Dismiss common modals/overlays (cookie notices, ads, etc.)
 */
export async function dismissModals(): Promise<void> {
  logger.debug('Attempting to dismiss modals/overlays');

  try {
    const stagehand = getBrowser();

    // Common modal dismiss patterns
    const dismissSelectors = [
      'button:has-text("Accept")',
      'button:has-text("OK")',
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
      '[aria-label="Close"]',
      '.close',
      '.modal-close',
      '.overlay-close',
    ];

    for (const selector of dismissSelectors) {
      try {
        const element = await stagehand.page.locator(selector).first();
        if (await element.isVisible({ timeout: 500 })) {
          await element.click();
          logger.info('Dismissed modal', { selector });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch {
        // Continue to next selector
      }
    }
  } catch (error) {
    logger.debug('No modals to dismiss or error occurred');
  }
}

/**
 * Wait for a brief moment (useful between actions)
 */
export async function wait(ms: number): Promise<void> {
  logger.debug('Waiting', { ms });
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if page is interactive (canvas or game container visible)
 */
export async function isGameVisible(): Promise<boolean> {
  try {
    const stagehand = getBrowser();

    const hasGameElements = await stagehand.page.evaluate(() => {
      // Check for canvas elements (common in HTML5 games)
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
        return true;
      }

      // Check for common game container IDs
      const containers = ['game', 'gameContainer', 'game-container', 'canvas-container'];
      for (const id of containers) {
        const el = document.getElementById(id);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          return true;
        }
      }

      return false;
    });

    logger.debug('Game visibility check', { hasGameElements });
    return hasGameElements;
  } catch (error) {
    logger.warn('Error checking game visibility', { error: (error as Error).message });
    return false;
  }
}

