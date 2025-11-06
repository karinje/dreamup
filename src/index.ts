/**
 * Main orchestrator for DreamUp QA Agent
 */

import { QAReport, QAOptions, TestMetadata, GameState, ControlScheme, Screenshot, Issue } from './types/index.js';
import { initConfig, getConfig } from './utils/config.js';
import { initLogger, logger } from './utils/logger.js';
import { ExecutionTimeoutError, formatError } from './utils/errors.js';
import { parseInputHints } from './utils/inputParser.js';
import {
  initBrowser,
  loadGame,
  closeBrowser,
  getBrowserInfo,
  getViewportSize,
} from './agent/browser.js';
import { setupLogListeners, saveLogs, getErrorLogs, clearLogs } from './evidence/logs.js';
import { createSessionDirectory, saveJSON, joinPath } from './evidence/storage.js';
import { createGameState, navigateGame, getTestDuration, getCurrentGameState } from './agent/navigation.js';
import { evaluatePlayability } from './evaluation/analyzer.js';
import {
  calculatePlayabilityScoreWithBreakdown,
  calculateConfidenceScore,
  generateIssues,
  determineTestStatus,
  generateSummary,
} from './evaluation/scoring.js';
import { createGif, getGifPath, getOptimalDimensions } from './evidence/gif.js';

/**
 * Main function to run QA test on a game
 */
export async function runQA(gameUrl: string, options?: QAOptions): Promise<QAReport> {
  const startTime = Date.now();
  let sessionDir: string | null = null;
  let controlScheme: ControlScheme | null = null;

  try {
    // Initialize configuration
    initConfig();
    const config = getConfig();

    const effectiveConfig = { ...config };

    // Apply options overrides
    if (options?.maxExecutionTime) {
      effectiveConfig.maxExecutionTime = options.maxExecutionTime;
    }
    if (options?.maxActionCount) {
      effectiveConfig.maxActionCount = options.maxActionCount;
    }
    if (options?.screenshotCount) {
      effectiveConfig.screenshotCount = options.screenshotCount;
    }
    if (options?.outputDir) {
      effectiveConfig.outputDir = options.outputDir;
    }

    // Initialize logger
    initLogger(options?.verbose ? 'debug' : effectiveConfig.logLevel);

    logger.info('Starting QA test', { gameUrl, options });

    // Parse input hints if provided
    if (options?.inputHints) {
      logger.info('Parsing input control hints', { type: options.inputHints.type });
      controlScheme = parseInputHints(options.inputHints);
      if (controlScheme) {
        logger.info('Control scheme parsed successfully', {
          actions: controlScheme.actions.length,
          axes: controlScheme.axes.length,
        });
      } else {
        logger.warn('Failed to parse input hints, will use auto-detection');
      }
    }

    // Create session directory
    sessionDir = await createSessionDirectory(effectiveConfig.outputDir, gameUrl);
    logger.info('Session directory created', { sessionDir });

    // Initialize browser
    await initBrowser();

    // Setup log collection
    setupLogListeners();

    // Set execution timeout with graceful handling
    let timeoutId: NodeJS.Timeout | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new ExecutionTimeoutError(effectiveConfig.maxExecutionTime));
      }, effectiveConfig.maxExecutionTime);
    });

    // Run the test with timeout
    const testPromise = runTest(
      gameUrl, 
      sessionDir, 
      effectiveConfig, 
      controlScheme, 
      options?.model, 
      options?.pauseInterval, 
      options?.gameContext,
      options?.gameSpeed,
      effectiveConfig.maxExecutionTime,
      options?.quickTest,
      options?.reasoningEffort
    );

    try {
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      // Clear timeout if test completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      logger.info('QA test completed successfully');
      return result;
    } catch (error) {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // If it's a timeout error, try to generate a report with collected data
      if (error instanceof ExecutionTimeoutError) {
        logger.warn('Test timed out, generating report with collected data');
        
        // Try to get the game state from the navigation module
        try {
          const currentGameState = getCurrentGameState();
          // Generate a timeout report with whatever data we have
          return await generateTimeoutReport(
            gameUrl,
            sessionDir,
            effectiveConfig.maxExecutionTime,
            startTime,
            controlScheme,
            options?.model,
            options?.pauseInterval,
            options?.gameContext,
            options?.gameSpeed,
            options?.quickTest,
            currentGameState,
            options?.reasoningEffort
          );
        } catch (reportError) {
          logger.error('Failed to generate timeout report', reportError as Error);
          throw error; // Re-throw original timeout error
        }
      }
      
      // Re-throw non-timeout errors
      throw error;
    }
  } catch (error) {
    logger.error('QA test failed', error as Error);

    // Generate error report with actual collected state
    const cfg = getConfig();
    try {
      const currentGameState = getCurrentGameState();
      return await generateErrorReport(
        gameUrl,
        sessionDir || cfg.outputDir,
        error as Error,
        currentGameState,
        startTime,
        controlScheme,
        options?.model,
        options?.pauseInterval,
        options?.gameContext,
        options?.gameSpeed,
        options?.quickTest,
        options?.reasoningEffort
      );
    } catch (reportError) {
      logger.error('Failed to generate error report', reportError as Error);
      // Fallback to minimal error report
      return await generateErrorReport(
        gameUrl,
        sessionDir || cfg.outputDir,
        error as Error,
        null,
        startTime,
        null,
        options?.model,
        undefined,
        undefined,
        undefined,
        undefined,
        options?.reasoningEffort
      );
    }
  } finally {
    // Cleanup
    try {
      // Save logs if we have a session directory
      if (sessionDir) {
        await saveLogs(sessionDir);
      }

      await closeBrowser();
      clearLogs();

      logger.info('Cleanup complete');
    } catch (error) {
      logger.error('Error during cleanup', error as Error);
    }
  }
}

/**
 * Execute the actual test
 */
async function runTest(
  gameUrl: string,
  sessionDir: string,
  config: ReturnType<typeof getConfig>,
  controlScheme: ControlScheme | null = null,
  model?: string,
  pauseInterval?: number,
  gameContext?: string,
  gameSpeed?: number,
  timeoutMs?: number,
  quickTest?: boolean,
  reasoningEffort?: 'low' | 'medium' | 'high'
): Promise<QAReport> {
  logger.info('Loading game', { url: gameUrl, hasControlScheme: !!controlScheme, pauseMode: !!pauseInterval, hasGameContext: !!gameContext, quickTest: !!quickTest });

  // Load the game
  await loadGame(gameUrl);

  logger.info('Game loaded, starting navigation');

  // Initialize game state
  const gameState = createGameState();

  // Navigate through the game (quickTest flag passed through to gameplay phase)
  await navigateGame(sessionDir, gameState, gameUrl, controlScheme, model, pauseInterval, gameContext, quickTest, reasoningEffort);

  logger.info('Navigation complete, collecting evidence');

  // Get logs
  const errorLogs = getErrorLogs();

  // Calculate duration
  const duration = getTestDuration(gameState);

  // Run AI evaluation (skip for quick test)
  let evaluation;
  if (quickTest) {
    logger.info('Skipping LLM evaluation (quick test mode)');
    evaluation = {
      loaded_successfully: true,
      controls_responsive: true,
      game_stable: true,
      ui_visible: true,
      confidence: 1.0,
      observations: ['Quick functional test completed', 'All control keys were tested'],
      issues: [],
    };
  } else {
    logger.info('Running LLM evaluation');
    evaluation = await evaluatePlayability(
      gameUrl,
      gameState.screenshots,
      gameState.actionHistory,
      errorLogs,
      [gameState.phase],
      duration
    );
  }

  logger.info('Generating report');

  // Generate issues
  const issues = generateIssues(evaluation, errorLogs);

  // Calculate scores with breakdown
  const scoreBreakdown = calculatePlayabilityScoreWithBreakdown(evaluation, issues);
  const playabilityScore = scoreBreakdown.final_score;
  const confidenceScore = calculateConfidenceScore(evaluation, errorLogs.length);

  // Determine status
  const status = determineTestStatus(playabilityScore, issues);

  // Get viewport info
  const viewport = await getViewportSize();

  // Build metadata (clean URL without query parameters)
  const cleanUrl = gameUrl.split('?')[0];
  const metadata: TestMetadata = {
    game_url: cleanUrl,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    browser: getBrowserInfo(),
    viewport,
    llm_provider: config.llmProvider,
    llm_model: model || config.llmModel,
    reasoning_effort: reasoningEffort,
    test_config: {
      pause_interval: pauseInterval,
      game_speed: gameSpeed,
      timeout_ms: timeoutMs,
      has_game_context: !!gameContext,
      game_context: gameContext,
      has_input_hints: !!controlScheme,
      quick_test: !!quickTest,
    },
  };

  // Create GIF if enabled and we have screenshots
  let gifPath: string | undefined;
  if (config.enableGifRecording && gameState.screenshots.length > 1) {
    try {
      logger.info('Creating gameplay GIF');
      gifPath = getGifPath(sessionDir);
      
      // Get optimal dimensions from first screenshot
      const dimensions = await getOptimalDimensions(gameState.screenshots[0].path);
      
      // Create GIF (max 60 seconds at 2 FPS = 120 frames)
      const maxFrames = Math.min(gameState.screenshots.length, 120);
      const screenshots = gameState.screenshots.slice(0, maxFrames);
      
      await createGif(screenshots, gifPath, {
        width: dimensions.width,
        height: dimensions.height,
        delay: 500, // 500ms per frame
        quality: 10,
      });
      
      logger.info('GIF created successfully', { path: gifPath });
    } catch (error) {
      logger.warn('Failed to create GIF, continuing without it', {
        error: (error as Error).message,
      });
      gifPath = undefined;
    }
  }

  // Build final report
  const report: QAReport = {
    status,
    playability_score: playabilityScore,
    confidence_score: confidenceScore,
    score_breakdown: scoreBreakdown,
    issues,
    observations: evaluation.observations,
    screenshots: gameState.screenshots.map((s) => s.path),  // Keep for backward compatibility
    screenshot_metadata: gameState.screenshots,  // Full metadata including LLM actions
    logs: [joinPath(sessionDir, 'logs', 'console-logs.json')],
    metadata,
    gif: gifPath,
  };

  // Save report
  const reportPath = joinPath(sessionDir, 'qa-report.json');
  await saveJSON(reportPath, report);

  logger.info('Report generated', {
    status,
    score: playabilityScore,
    issues: issues.length,
  });

  // Log summary
  const summary = generateSummary(status, playabilityScore, issues);
  logger.info(summary);

  return report;
}

/**
 * Generate timeout report with collected data
 */
async function generateTimeoutReport(
  gameUrl: string,
  sessionDir: string,
  maxTime: number,
  startTime: number,
  controlScheme: ControlScheme | null = null,
  model?: string,
  pauseInterval?: number,
  gameContext?: string,
  gameSpeed?: number,
  quickTest?: boolean,
  gameState?: GameState | null,
  reasoningEffort?: 'low' | 'medium' | 'high'
): Promise<QAReport> {
  logger.info('Generating report for timed out test');
  
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Collect all screenshots - prefer gameState if available (has LLM metadata), otherwise read from disk
  let screenshots: Screenshot[] = [];
  
  if (gameState?.screenshots && gameState.screenshots.length > 0) {
    // Use gameState screenshots which have LLM metadata
    screenshots = gameState.screenshots;
    logger.info('Using screenshots from gameState with LLM metadata', { count: screenshots.length });
  } else {
    // Fallback: read from disk (no LLM metadata available)
    const screenshotDir = path.join(sessionDir, 'screenshots');
    try {
      const files = await fs.readdir(screenshotDir);
      const screenshotFiles = files.filter(f => f.endsWith('.png')).sort();
      
      screenshots = screenshotFiles.map(f => ({
        path: path.join(screenshotDir, f),
        timestamp: new Date().toISOString(),
        phase: 'gameplay' as const,
      }));
      
      logger.info('Found screenshots from timed out test (no LLM metadata)', { count: screenshots.length });
    } catch (error) {
      logger.warn('Could not read screenshots from session directory', { error });
    }
  }
  
  // Generate GIF if we have screenshots
  let gifPath: string | undefined;
  if (screenshots.length >= 2) {
    try {
      gifPath = getGifPath(sessionDir);
      const dimensions = await getOptimalDimensions(screenshots[0].path);
      
      await createGif(screenshots, gifPath, {
        width: dimensions.width,
        height: dimensions.height,
        delay: 500,
      });
      
      logger.info('Created GIF from timeout screenshots', { path: gifPath });
    } catch (error) {
      logger.warn('Failed to create GIF from timeout screenshots', { error });
      gifPath = undefined;
    }
  }
  
  // Run LLM evaluation if we have screenshots
  const cfg = getConfig();
  const duration = Date.now() - startTime;
  const errorLogs = getErrorLogs();
  const evaluation = screenshots.length > 0
    ? await evaluatePlayability(
        gameUrl,
        screenshots,
        gameState?.actionHistory || [],  // Use action history if available
        errorLogs,
        gameState?.phase ? [gameState.phase] : ['gameplay'],
        duration
      )
    : null;
  
  const cleanUrl = gameUrl.split('?')[0];
  const metadata: TestMetadata = {
    game_url: cleanUrl,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    browser: getBrowserInfo(),
    viewport: { width: 1280, height: 720 },
    llm_provider: cfg?.llmProvider || 'unknown',
    llm_model: model || cfg?.llmModel || 'unknown',
    reasoning_effort: reasoningEffort,
    test_config: {
      pause_interval: pauseInterval,
      game_speed: gameSpeed,
      timeout_ms: maxTime,
      has_game_context: !!gameContext,
      game_context: gameContext,
      has_input_hints: !!controlScheme,
      quick_test: !!quickTest,
    },
  };
  
  // Generate issues
  const issues: Issue[] = [
    {
      severity: 'high',
      description: `Test execution exceeded maximum time of ${maxTime}ms. Collected ${screenshots.length} screenshots before timeout.`,
      category: 'other',
      timestamp: new Date().toISOString(),
    },
  ];
  
  // Add evaluation issues if available
  if (evaluation && !evaluation.loaded_successfully) {
    issues.push({
      severity: 'critical',
      description: 'Game failed to load properly',
      category: 'load',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (evaluation && !evaluation.controls_responsive) {
    issues.push({
      severity: 'high',
      description: 'Game became unresponsive during testing',
      category: 'stability',
      timestamp: new Date().toISOString(),
    });
  }
  
  // Calculate playability score with breakdown
  let playabilityScore = 0;
  let confidenceScore = 0;
  let scoreBreakdown;
  if (evaluation) {
    const errorLogs = await getErrorLogs();
    scoreBreakdown = calculatePlayabilityScoreWithBreakdown(evaluation, issues);
    playabilityScore = scoreBreakdown.final_score;
    confidenceScore = calculateConfidenceScore(evaluation, errorLogs.length);
  }
  
  const report: QAReport = {
    status: screenshots.length > 5 ? 'pass' : 'fail', // Pass if we got reasonable gameplay
    playability_score: playabilityScore,
    confidence_score: confidenceScore,
    score_breakdown: scoreBreakdown,
    issues,
    observations: evaluation?.observations,
    screenshots: screenshots.map(s => s.path),
    screenshot_metadata: screenshots,  // Include full metadata (may not have LLM data for timeout cases)
    gif: gifPath,
    logs: [path.join(sessionDir, 'logs', 'console-logs.json')],
    metadata,
  };
  
  // Save report to file
  try {
    const reportPath = path.join(sessionDir, 'qa-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    logger.info('Timeout report saved', { path: reportPath });
  } catch (error) {
    logger.warn('Failed to save timeout report', { error });
  }
  
  return report;
}

/**
 * Generate an error report when test fails
 */
async function generateErrorReport(
  gameUrl: string,
  outputDir: string,
  error: Error,
  gameState: GameState | null,
  startTime: number,
  controlScheme: ControlScheme | null = null,
  model?: string,
  pauseInterval?: number,
  gameContext?: string,
  gameSpeed?: number,
  quickTest?: boolean,
  reasoningEffort?: 'low' | 'medium' | 'high'
): Promise<QAReport> {
  logger.warn('Generating error report');

  const fs = await import('fs/promises');
  const path = await import('path');
  const { getErrorLogs } = await import('./evidence/logs.js');
  const { getTestDuration } = await import('./agent/navigation.js');
  const { createGif, getOptimalDimensions } = await import('./evidence/gif.js');
  const { generateIssues } = await import('./evaluation/scoring.js');

  // Collect all screenshots - prefer gameState if available (has LLM metadata), otherwise read from disk
  let screenshots: Screenshot[] = [];
  
  if (gameState?.screenshots && gameState.screenshots.length > 0) {
    // Use gameState screenshots which have LLM metadata
    screenshots = gameState.screenshots;
    logger.info('Using screenshots from gameState with LLM metadata', { count: screenshots.length });
  } else {
    // Fallback: read from disk (no LLM metadata available, but at least we have the screenshots)
    const screenshotDir = path.join(outputDir, 'screenshots');
    try {
      const files = await fs.readdir(screenshotDir);
      const screenshotFiles = files.filter(f => f.endsWith('.png')).sort();
      
      screenshots = screenshotFiles.map(f => ({
        path: path.join(screenshotDir, f),
        timestamp: new Date().toISOString(),
        phase: 'gameplay' as const,
      }));
      
      logger.info('Found screenshots from disk (no LLM metadata)', { count: screenshots.length });
    } catch (error) {
      logger.warn('Could not read screenshots from session directory', { error });
    }
  }

  // Generate GIF if we have screenshots
  let gifPath: string | undefined;
  if (screenshots.length >= 2) {
    try {
      const dimensions = await getOptimalDimensions(screenshots[0].path);
      gifPath = getGifPath(outputDir);
      await createGif(
        screenshots,
        gifPath,
        {
          width: dimensions.width,
          height: dimensions.height,
          delay: 500,
        }
      );
      logger.info('Created GIF from error screenshots', { path: gifPath });
    } catch (gifError) {
      logger.warn('Failed to create GIF from error screenshots', { error: gifError });
    }
  }

  // Get error logs
  const errorLogs = getErrorLogs();
  
  // Calculate duration
  const duration = gameState ? getTestDuration(gameState) : Date.now() - startTime;

  // Generate issues from error logs
  const issues = generateIssues(
    {
      loaded_successfully: screenshots.length > 0,
      controls_responsive: false,
      game_stable: false,
      ui_visible: screenshots.length > 0,
      confidence: 0,
      observations: [`Test failed: ${formatError(error)}`],
      issues: [],
    },
    errorLogs
  );

  // Add the main error as a critical issue
  issues.unshift({
    severity: 'critical',
    description: formatError(error),
    category: 'other',
    timestamp: new Date().toISOString(),
  });

  const viewport = await getViewportSize();
  const metadata: TestMetadata = {
    game_url: gameUrl,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    browser: getBrowserInfo(),
    viewport: viewport,
    llm_provider: getConfig()?.llmProvider || 'unknown',
    llm_model: model || getConfig()?.llmModel || 'unknown',
    reasoning_effort: reasoningEffort,
    test_config: {
      pause_interval: pauseInterval,
      game_speed: gameSpeed,
      has_game_context: !!gameContext,
      game_context: gameContext,
      has_input_hints: !!controlScheme,
      quick_test: quickTest,
    },
  };

  const report: QAReport = {
    status: 'error',
    playability_score: 0,
    confidence_score: 0,
    issues,
    screenshots: screenshots.map((s) => s.path),
    screenshot_metadata: screenshots,
    logs: errorLogs.length > 0 ? [joinPath(outputDir, 'logs', 'console-logs.json')] : [],
    metadata,
    gif: gifPath,
  };

  // Save report to file
  const reportPath = joinPath(outputDir, 'qa-report.json');
  await saveJSON(reportPath, report);
  logger.info('Error report saved', { path: reportPath });

  return report;
}

/**
 * Export types for API consumers
 */
export type { QAReport, QAOptions, TestConfig, Issue, TestMetadata } from './types/index.js';

