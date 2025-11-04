/**
 * Main orchestrator for DreamUp QA Agent
 */

import { QAReport, QAOptions, TestMetadata, GameState } from './types/index.js';
import { initConfig, getConfig } from './utils/config.js';
import { initLogger, logger } from './utils/logger.js';
import { ExecutionTimeoutError, formatError } from './utils/errors.js';
import {
  initBrowser,
  loadGame,
  closeBrowser,
  getBrowserInfo,
  getViewportSize,
} from './agent/browser.js';
import { setupLogListeners, saveLogs, getErrorLogs, clearLogs } from './evidence/logs.js';
import { createSessionDirectory, saveJSON, joinPath } from './evidence/storage.js';
import { createGameState, navigateGame, getTestDuration } from './agent/navigation.js';
import { evaluatePlayability } from './evaluation/analyzer.js';
import {
  calculatePlayabilityScore,
  calculateConfidenceScore,
  generateIssues,
  determineTestStatus,
  generateSummary,
} from './evaluation/scoring.js';

/**
 * Main function to run QA test on a game
 */
export async function runQA(gameUrl: string, options?: QAOptions): Promise<QAReport> {
  const startTime = Date.now();
  let sessionDir: string | null = null;
  let gameState: GameState | null = null;

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

    // Create session directory
    sessionDir = await createSessionDirectory(effectiveConfig.outputDir, gameUrl);
    logger.info('Session directory created', { sessionDir });

    // Initialize browser
    await initBrowser();

    // Setup log collection
    setupLogListeners();

    // Set execution timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ExecutionTimeoutError(effectiveConfig.maxExecutionTime));
      }, effectiveConfig.maxExecutionTime);
    });

    // Run the test with timeout
    const testPromise = runTest(gameUrl, sessionDir, effectiveConfig);

    const result = await Promise.race([testPromise, timeoutPromise]);

    logger.info('QA test completed successfully');
    return result;
  } catch (error) {
    logger.error('QA test failed', error as Error);

    // Generate error report
    const cfg = getConfig();
    return generateErrorReport(
      gameUrl,
      sessionDir || cfg.outputDir,
      error as Error,
      gameState,
      startTime
    );
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
  config: ReturnType<typeof getConfig>
): Promise<QAReport> {
  logger.info('Loading game', { url: gameUrl });

  // Load the game
  await loadGame(gameUrl);

  logger.info('Game loaded, starting navigation');

  // Initialize game state
  const gameState = createGameState();

  // Navigate through the game
  await navigateGame(sessionDir, gameState, gameUrl);

  logger.info('Navigation complete, collecting evidence');

  // Get logs
  const errorLogs = getErrorLogs();

  // Calculate duration
  const duration = getTestDuration(gameState);

  logger.info('Running LLM evaluation');

  // Run AI evaluation
  const evaluation = await evaluatePlayability(
    gameUrl,
    gameState.screenshots,
    gameState.actionHistory,
    errorLogs,
    [gameState.phase],
    duration
  );

  logger.info('Generating report');

  // Generate issues
  const issues = generateIssues(evaluation, errorLogs);

  // Calculate scores
  const playabilityScore = calculatePlayabilityScore(evaluation, issues);
  const confidenceScore = calculateConfidenceScore(evaluation, errorLogs.length);

  // Determine status
  const status = determineTestStatus(playabilityScore, issues);

  // Get viewport info
  const viewport = await getViewportSize();

  // Build metadata
  const metadata: TestMetadata = {
    game_url: gameUrl,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    browser: getBrowserInfo(),
    viewport,
    llm_provider: config.llmProvider,
    llm_model: config.llmModel,
  };

  // Build final report
  const report: QAReport = {
    status,
    playability_score: playabilityScore,
    confidence_score: confidenceScore,
    issues,
    screenshots: gameState.screenshots.map((s) => s.path),
    logs: [joinPath(sessionDir, 'logs', 'console-logs.json')],
    metadata,
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
 * Generate an error report when test fails
 */
function generateErrorReport(
  gameUrl: string,
  _outputDir: string,
  error: Error,
  gameState: GameState | null,
  startTime: number
): QAReport {
  logger.warn('Generating error report');

  const metadata: TestMetadata = {
    game_url: gameUrl,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    browser: getBrowserInfo(),
    viewport: { width: 1280, height: 720 },
    llm_provider: getConfig()?.llmProvider || 'unknown',
    llm_model: getConfig()?.llmModel || 'unknown',
  };

  const report: QAReport = {
    status: 'error',
    playability_score: 0,
    confidence_score: 0,
    issues: [
      {
        severity: 'critical',
        description: formatError(error),
        category: 'other',
        timestamp: new Date().toISOString(),
      },
    ],
    screenshots: gameState?.screenshots.map((s) => s.path) || [],
    logs: [],
    metadata,
  };

  return report;
}

/**
 * Export types for API consumers
 */
export type { QAReport, QAOptions, TestConfig, Issue, TestMetadata } from './types/index.js';

