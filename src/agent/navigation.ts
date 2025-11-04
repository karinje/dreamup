/**
 * Game navigation and state management
 */

import { GameState, GamePhase, ActionResult, Screenshot } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { NavigationError } from '../utils/errors.js';
import { getConfig } from '../utils/config.js';
import {
  clickStartButton,
  detectGameOver,
  simulateGameplayInput,
  clickCenter,
  performRandomClicks,
  detectControls,
  dismissModals,
  wait,
  isGameVisible,
} from './interactions.js';
import { captureScreenshot } from '../evidence/screenshots.js';
import { isPageResponsive } from './browser.js';

/**
 * Initialize game state
 */
export function createGameState(): GameState {
  return {
    phase: 'loading',
    actionCount: 0,
    startTime: Date.now(),
    lastActionTime: Date.now(),
    screenshots: [],
    logs: [],
    errors: [],
    actionHistory: [],
  };
}

/**
 * Navigate through the game autonomously
 */
export async function navigateGame(
  sessionDir: string,
  state: GameState
): Promise<GameState> {
  const config = getConfig();
  logger.info('Starting autonomous game navigation');

  try {
    // Phase 1: Initial load
    state.phase = 'loading';
    await wait(2000); // Wait for initial render

    // Dismiss any modals
    await dismissModals();

    // Capture initial screenshot
    const initialScreenshot = await captureScreenshot(sessionDir, 'initial_load', 'loading');
    state.screenshots.push(initialScreenshot);
    state.actionHistory.push('Captured initial screenshot');

    // Phase 2: Check if game is visible
    const gameVisible = await isGameVisible();
    if (!gameVisible) {
      logger.warn('Game canvas not immediately visible');
      state.errors.push('Game canvas not detected');
    }

    // Phase 3: Try to start the game
    state.phase = 'start_screen';
    logger.info('Attempting to start game');

    const startClicked = await clickStartButton();
    if (startClicked) {
      state.actionHistory.push('Clicked start button');
      await wait(2000);

      const startScreenshot = await captureScreenshot(sessionDir, 'after_start', 'start_screen');
      state.screenshots.push(startScreenshot);
      state.actionCount++;
    } else {
      logger.info('No start button found, attempting center click');
      await clickCenter();
      state.actionHistory.push('Clicked center of viewport');
      await wait(1000);
      state.actionCount++;
    }

    // Phase 4: Gameplay
    state.phase = 'gameplay';
    logger.info('Entering gameplay phase');

    await conductGameplaySession(sessionDir, state, config.maxActionCount);

    // Phase 5: Check final state
    const isGameOver = await detectGameOver();
    if (isGameOver) {
      state.phase = 'game_over';
      logger.info('Game over screen detected');
    } else {
      state.phase = 'completed';
      logger.info('Game session completed');
    }

    // Final screenshot
    const finalScreenshot = await captureScreenshot(sessionDir, 'final_state', state.phase);
    state.screenshots.push(finalScreenshot);

    logger.info('Navigation complete', {
      phase: state.phase,
      actions: state.actionCount,
      screenshots: state.screenshots.length,
    });

    return state;
  } catch (error) {
    const err = error as Error;
    logger.error('Navigation error', err);
    state.phase = 'crashed';
    state.errors.push(err.message);
    throw new NavigationError(`Navigation failed: ${err.message}`);
  }
}

/**
 * Conduct an active gameplay session
 */
async function conductGameplaySession(
  sessionDir: string,
  state: GameState,
  maxActions: number
): Promise<void> {
  logger.info('Starting gameplay session', { maxActions });

  const controls = await detectControls();
  const hasKeyboard = controls.includes('keyboard');

  const screenshotInterval = Math.floor(maxActions / 4); // Take ~4 screenshots during gameplay

  for (let i = 0; i < maxActions && state.actionCount < maxActions; i++) {
    try {
      // Check if page is still responsive
      const responsive = await isPageResponsive();
      if (!responsive) {
        logger.warn('Page appears unresponsive');
        state.errors.push('Page became unresponsive');
        break;
      }

      // Check for game over
      const gameOver = await detectGameOver();
      if (gameOver) {
        logger.info('Game over detected during gameplay');
        break;
      }

      // Perform gameplay actions
      if (hasKeyboard) {
        // Keyboard-based gameplay
        await simulateGameplayInput(3000); // 3 seconds of input
        state.actionHistory.push('Simulated keyboard gameplay (3s)');
        state.actionCount += 5; // Count as multiple actions
      } else {
        // Click-based gameplay
        await performRandomClicks(3, 800);
        state.actionHistory.push('Performed random clicks');
        state.actionCount += 3;
      }

      // Capture screenshot at intervals
      if (i % screenshotInterval === 0 && state.screenshots.length < 10) {
        const screenshot = await captureScreenshot(
          sessionDir,
          `gameplay_${i}`,
          'gameplay'
        );
        state.screenshots.push(screenshot);
      }

      state.lastActionTime = Date.now();

      // Small delay between action sequences
      await wait(1000);

      // Check if we're stuck (same state for too long)
      if (await isStuck(state)) {
        logger.warn('Game appears stuck, attempting recovery');
        await attemptUnstick(state);
      }
    } catch (error) {
      logger.warn('Error during gameplay action', {
        error: (error as Error).message,
        action: i,
      });
      state.errors.push(`Gameplay error: ${(error as Error).message}`);
      // Continue with next action
    }
  }

  logger.info('Gameplay session complete', {
    actions: state.actionCount,
    screenshots: state.screenshots.length,
  });
}

/**
 * Check if the game appears stuck
 */
async function isStuck(state: GameState): Promise<boolean> {
  // If we've performed many actions with no screenshot changes, we might be stuck
  const timeSinceLastAction = Date.now() - state.lastActionTime;
  const stuckTimeout = 30000; // 30 seconds

  if (timeSinceLastAction > stuckTimeout) {
    return true;
  }

  // If action history shows repeated failures
  const recentActions = state.actionHistory.slice(-5);
  const failureCount = recentActions.filter((a) => a.includes('error') || a.includes('failed')).length;

  return failureCount >= 3;
}

/**
 * Attempt to unstick the game
 */
async function attemptUnstick(state: GameState): Promise<void> {
  logger.info('Attempting to unstick game');

  try {
    // Try clicking center
    await clickCenter();
    await wait(500);

    // Try some random clicks
    await performRandomClicks(2, 500);

    state.actionHistory.push('Attempted unstick maneuver');
  } catch (error) {
    logger.warn('Unstick attempt failed', { error: (error as Error).message });
  }
}

/**
 * Execute a single test action and record results
 */
export async function executeAction(
  action: string,
  sessionDir: string,
  phase: GamePhase
): Promise<ActionResult> {
  const timestamp = new Date().toISOString();

  logger.debug('Executing action', { action, phase });

  try {
    // Execute the action based on type
    // This is a simplified version - can be extended

    let screenshot: Screenshot | undefined;

    // Capture screenshot after action
    try {
      screenshot = await captureScreenshot(sessionDir, action, phase);
    } catch (error) {
      logger.warn('Failed to capture screenshot after action');
    }

    return {
      success: true,
      action,
      timestamp,
      screenshot: screenshot?.path,
      phase,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Action execution failed', err, { action });

    return {
      success: false,
      action,
      timestamp,
      error: err.message,
      phase,
    };
  }
}

/**
 * Calculate test duration
 */
export function getTestDuration(state: GameState): number {
  return Date.now() - state.startTime;
}

/**
 * Get game phases traversed
 */
export function getPhaseHistory(state: GameState): GamePhase[] {
  // Extract unique phases from action history
  // This is a simplified version
  return [state.phase];
}

/**
 * Check if maximum execution time exceeded
 */
export function isExecutionTimeExceeded(state: GameState, maxTime: number): boolean {
  return getTestDuration(state) > maxTime;
}

