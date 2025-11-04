/**
 * Game navigation and state management
 */

import { GameState, GamePhase, ActionResult, Screenshot } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { NavigationError } from '../utils/errors.js';
import { getConfig } from '../utils/config.js';
import {
  detectGameOver,
  simulateGameplayInput,
  clickCenter,
  wait,
  executeRecommendedAction,
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
  state: GameState,
  gameUrl: string
): Promise<GameState> {
  const config = getConfig();
  logger.info('Starting autonomous game navigation');

  try {
    // Import LLM analyzers
    const { detectModal, findGameStart } = await import('../evaluation/analyzer.js');
    const stagehand = (await import('./browser.js')).getBrowser();

    // Phase 1: Initial load
    state.phase = 'loading';
    await wait(2000); // Wait for initial render

    // Capture initial screenshot for LLM analysis
    const initialScreenshot = await captureScreenshot(sessionDir, 'initial_load', 'loading');
    state.screenshots.push(initialScreenshot);
    state.actionHistory.push('Captured initial screenshot');

    // Phase 2: LLM-driven modal detection and dismissal
    logger.info('Using LLM to detect and handle modals');
    const modalDetection = await detectModal(initialScreenshot);
    
    if (modalDetection.has_modal && modalDetection.confidence > 0.5) {
      logger.info('LLM detected modal, attempting to dismiss', {
        type: modalDetection.modal_type,
        action: modalDetection.recommended_action,
      });
      
      try {
        // Use Stagehand's act to execute LLM's recommendation
        await stagehand.act({ action: modalDetection.recommended_action });
        state.actionHistory.push(`Dismissed ${modalDetection.modal_type} modal: ${modalDetection.recommended_action}`);
        await wait(2000);
        
        // Capture screenshot after modal dismissal
        const postModalScreenshot = await captureScreenshot(sessionDir, 'after_modal_dismiss', 'loading');
        state.screenshots.push(postModalScreenshot);
      } catch (error) {
        logger.warn('Failed to dismiss modal with LLM action', { error: (error as Error).message });
        // Continue anyway
      }
    }

    // Phase 3: LLM-driven game start detection
    state.phase = 'start_screen';
    logger.info('Using LLM to find how to start the game');
    
    const latestScreenshot = state.screenshots[state.screenshots.length - 1];
    const gameStartInfo = await findGameStart(latestScreenshot, state.actionHistory);
    
    logger.info('LLM game start analysis', {
      state: gameStartInfo.game_state,
      mechanism: gameStartInfo.start_mechanism,
      confidence: gameStartInfo.confidence,
    });

    if (gameStartInfo.game_state === 'already_started') {
      logger.info('LLM detected game is already playing');
      state.actionHistory.push('LLM: Game already started, no action needed');
    } else if (gameStartInfo.confidence > 0.5) {
      // Execute LLM's recommendation to start the game
      try {
        await stagehand.act({ action: gameStartInfo.start_mechanism });
        state.actionHistory.push(`LLM start game: ${gameStartInfo.start_mechanism}`);
        await wait(2000);
        state.actionCount++;

        const startScreenshot = await captureScreenshot(sessionDir, 'after_start', 'start_screen');
        state.screenshots.push(startScreenshot);
      } catch (error) {
        logger.warn('Failed to start game with LLM action, trying fallback', {
          error: (error as Error).message,
        });
        
        // Fallback: click center
        await clickCenter();
        state.actionHistory.push('Fallback: Clicked center of viewport');
        await wait(1000);
        state.actionCount++;
      }
    } else {
      // Low confidence, use fallback
      logger.info('LLM confidence too low, using fallback start method');
      await clickCenter();
      state.actionHistory.push('Fallback: Clicked center (low LLM confidence)');
      await wait(1000);
      state.actionCount++;
    }

    // Phase 4: Gameplay
    state.phase = 'gameplay';
    logger.info('Entering gameplay phase');

    await conductGameplaySession(sessionDir, state, config.maxActionCount, gameUrl);

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
 * Conduct an active gameplay session with LLM-driven actions
 */
async function conductGameplaySession(
  sessionDir: string,
  state: GameState,
  maxActions: number,
  gameUrl: string
): Promise<void> {
  logger.info('Starting LLM-driven gameplay session', { maxActions });
  
  // Import here to avoid circular dependency
  const { getGameplayAction } = await import('../evaluation/analyzer.js');

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

      // Capture screenshot for LLM analysis (every 3 iterations or if we have none)
      let currentScreenshot = state.screenshots[state.screenshots.length - 1];
      if (!currentScreenshot || i % 3 === 0) {
        currentScreenshot = await captureScreenshot(
          sessionDir,
          `gameplay_${i}`,
          'gameplay'
        );
        state.screenshots.push(currentScreenshot);
      }

      // Get LLM recommendation for next action
      const recommendation = await getGameplayAction(
        gameUrl,
        currentScreenshot,
        state.actionHistory,
        state.phase
      );

      logger.info('LLM recommended action', {
        action: recommendation.action_type,
        description: recommendation.description,
        confidence: recommendation.confidence,
      });

      // Execute the recommended action
      await executeRecommendedAction(recommendation.action_type, 3000);
      
      state.actionHistory.push(
        `LLM action: ${recommendation.action_type} - ${recommendation.description}`
      );
      state.actionCount += 5;

      state.lastActionTime = Date.now();

      // Small delay between action sequences
      await wait(1000);

      // Check if we're stuck (same state for too long)
      if (await isStuck(state)) {
        logger.warn('Game appears stuck, attempting recovery');
        await attemptUnstick(state);
      }
    } catch (error) {
      logger.warn('Error during gameplay action, falling back to simple controls', {
        error: (error as Error).message,
        action: i,
      });
      
      // Fallback to simple keyboard controls
      try {
        await simulateGameplayInput(3000);
        state.actionHistory.push('Fallback: keyboard input');
        state.actionCount += 3;
      } catch (fallbackError) {
        state.errors.push(`Gameplay error: ${(error as Error).message}`);
      }
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
    // Try clicking center and some key presses
    await clickCenter();
    await wait(500);

    // Try some keyboard input
    await simulateGameplayInput(1000);

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

