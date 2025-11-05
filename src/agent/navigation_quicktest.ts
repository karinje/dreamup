/**
 * Quick test mode: Press all control keys in sequence without LLM
 * Fast functional testing for input validation
 */

import { GameState, ControlScheme } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { captureScreenshot } from '../evidence/screenshots.js';
import { pressKey, wait } from './interactions.js';
import { isPageResponsive } from './browser.js';

export async function conductQuickTest(
  sessionDir: string,
  state: GameState,
  controlScheme: ControlScheme | null = null
): Promise<void> {
  logger.info('Starting quick test mode (functional key testing, no LLM)');

  // Extract keys to test
  let keysToTest: string[] = [];
  if (controlScheme) {
    // Get keys from control scheme
    for (const action of controlScheme.actions) {
      keysToTest.push(...action.keys);
    }
    for (const axis of controlScheme.axes) {
      keysToTest.push(...axis.keys);
    }
    // Remove duplicates
    keysToTest = Array.from(new Set(keysToTest));
    logger.info('Testing keys from control scheme', { keys: keysToTest, count: keysToTest.length });
  } else {
    // Use default keys
    keysToTest = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '];
    logger.info('Testing default keys', { keys: keysToTest, count: keysToTest.length });
  }

  // Track key press counts
  const keyPressCounts: Record<string, number> = {};
  keysToTest.forEach(key => keyPressCounts[key] = 0);

  const startTime = Date.now();
  let totalKeyPresses = 0;
  let screenshotCounter = 0;

  // Keep pressing keys until timeout (30 seconds max)
  while (Date.now() - startTime < 30000) {
    // Check if page is still responsive
    const responsive = await isPageResponsive();
    if (!responsive) {
      logger.warn('Page appears unresponsive during quick test');
      break;
    }

    // Get random key to press
    const key = keysToTest[Math.floor(Math.random() * keysToTest.length)];
    
    // Press the key
    try {
      await pressKey(key, 100);
      keyPressCounts[key]++;
      totalKeyPresses++;
      state.actionHistory.push(`Pressed ${key} (count: ${keyPressCounts[key]})`);
      state.actionCount++;
      
      logger.debug('Quick test key press', { key, count: keyPressCounts[key] });
    } catch (error) {
      logger.warn('Failed to press key during quick test', { key, error: (error as Error).message });
    }

    // Wait 500ms between key presses
    await wait(500);

    // Capture screenshot every 3 seconds (every ~6 keys at 500ms per key)
    if (totalKeyPresses % 6 === 0) {
      try {
        const screenshot = await captureScreenshot(
          sessionDir,
          `quick_test_${screenshotCounter}`,
          'gameplay'
        );
        state.screenshots.push(screenshot);
        screenshotCounter++;
        logger.debug('Quick test screenshot captured', { count: screenshotCounter });
      } catch (error) {
        logger.warn('Failed to capture screenshot during quick test', { error: (error as Error).message });
      }
    }
  }

  // Log final summary
  logger.info('Quick test complete', { 
    duration: Date.now() - startTime,
    totalKeyPresses: state.actionCount,
    screenshots: state.screenshots.length,
    keyPressCounts 
  });

  // Add summary to action history
  const summaryLines: string[] = ['=== Quick Test Summary ==='];
  Object.entries(keyPressCounts).forEach(([key, count]) => {
    summaryLines.push(`${key}: pressed ${count} times`);
  });
  state.actionHistory.push(...summaryLines);
}

