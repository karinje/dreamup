/**
 * Batch Testing Runner
 * Runs multiple QA tests in parallel with configurable combinations
 */

import { runQA } from './index.js';
import { QAReport, QAOptions, BatchTestConfig, BatchTestReport } from './types/index.js';
import { createSessionDirectory, saveJSON, joinPath } from './evidence/storage.js';
import { initLogger, logger } from './utils/logger.js';
import { initConfig } from './utils/config.js';

/**
 * Generate all combinations from a batch config
 */
function generateCombinations(config: BatchTestConfig): Array<{
  gameUrl: string;
  gameName?: string;
  options: QAOptions;
  label: string;
}> {
  const combinations: Array<{
    gameUrl: string;
    gameName?: string;
    options: QAOptions;
    label: string;
  }> = [];

  // Get all arrays from config
  const games = config.games || [];
  const models = config.models || [undefined];
  const pauseIntervals = config.pauseInterval || [undefined];
  const globalGameSpeeds = config.gameSpeed || [undefined];
  const globalInputHints = config.inputHints || [undefined];
  const globalGameContexts = config.gameContext || [undefined];
  const quickTests = config.quickTest !== undefined ? [config.quickTest] : [undefined, true];
  const reasoningEfforts = config.reasoningEffort || [undefined];
  const timeouts = config.timeout || [undefined];
  const maxActionCounts = config.maxActionCount || [undefined];
  const globalCollectPerformance = config.collectPerformanceMetrics;

  // Generate all combinations
  for (const game of games) {
    // Parse game config
    let gameUrl: string;
    let gameName: string | undefined;
    let gameInputHints: Array<typeof globalInputHints[0]>;
    let gameContexts: Array<typeof globalGameContexts[0]>;
    let gameModels: Array<string | undefined>;
    let gamePauseIntervals: Array<number | undefined>;
    let gameSpeeds: Array<number | undefined>;
    let gameQuickTests: Array<boolean | undefined>;
    let gameReasoningEfforts: Array<typeof reasoningEfforts[0]>;
    let gameTimeouts: Array<number | undefined>;
    let gameMaxActionCounts: Array<number | undefined>;
    let gameCollectPerformance: boolean | undefined;
    
    if (typeof game === 'string') {
      // Simple URL string - use all global defaults
      gameUrl = game;
      gameName = undefined;
      gameInputHints = globalInputHints;
      gameContexts = globalGameContexts;
      gameModels = models;
      gamePauseIntervals = pauseIntervals;
      gameSpeeds = globalGameSpeeds;
      gameQuickTests = quickTests;
      gameReasoningEfforts = reasoningEfforts;
      gameTimeouts = timeouts;
      gameMaxActionCounts = maxActionCounts;
      gameCollectPerformance = globalCollectPerformance;
    } else {
      // Game config object - use per-game overrides if provided, otherwise global defaults
      gameUrl = game.url;
      gameName = game.name;
      
      // Per-game settings take priority (single value, no combinations)
      // If not specified, use global arrays for combinations
      gameInputHints = game.inputHints ? [game.inputHints] : globalInputHints;
      gameContexts = game.gameContext ? [game.gameContext] : globalGameContexts;
      gameModels = game.model ? [game.model] : models;
      gamePauseIntervals = game.pauseInterval !== undefined ? [game.pauseInterval] : pauseIntervals;
      gameSpeeds = game.gameSpeed !== undefined ? [game.gameSpeed] : globalGameSpeeds;
      gameQuickTests = game.quickTest !== undefined ? [game.quickTest] : quickTests;
      gameReasoningEfforts = game.reasoningEffort ? [game.reasoningEffort] : reasoningEfforts;
      gameTimeouts = game.timeout !== undefined ? [game.timeout] : timeouts;
      gameMaxActionCounts = game.maxActionCount !== undefined ? [game.maxActionCount] : maxActionCounts;
      gameCollectPerformance =
        game.collectPerformanceMetrics !== undefined ? game.collectPerformanceMetrics : globalCollectPerformance;
    }

    // Generate combinations for this game
    for (const model of gameModels) {
      for (const pauseInterval of gamePauseIntervals) {
        for (const gameSpeed of gameSpeeds) {
          for (const hint of gameInputHints) {
            for (const context of gameContexts) {
              for (const quickTest of gameQuickTests) {
                for (const reasoningEffort of gameReasoningEfforts) {
                  for (const timeout of gameTimeouts) {
                    for (const maxActionCount of gameMaxActionCounts) {
                      const options: QAOptions = {};

                      if (model) options.model = model;
                      if (pauseInterval !== undefined) options.pauseInterval = pauseInterval;
                      if (gameSpeed !== undefined) options.gameSpeed = gameSpeed;
                      if (hint) options.inputHints = hint;
                      if (context) options.gameContext = context;
                      if (quickTest !== undefined) options.quickTest = quickTest;
                      if (reasoningEffort) options.reasoningEffort = reasoningEffort;
                      if (timeout) options.maxExecutionTime = timeout;
                      if (maxActionCount) options.maxActionCount = maxActionCount;
                      if (gameCollectPerformance !== undefined) options.collectPerformanceMetrics = gameCollectPerformance;

                      // Generate label for this combination
                      const parts: string[] = [];
                      if (model) parts.push(`model:${model}`);
                      if (pauseInterval !== undefined) parts.push(`pause:${pauseInterval}`);
                      if (gameSpeed !== undefined) parts.push(`speed:${gameSpeed}`);
                      if (quickTest) parts.push('quick');
                      if (hint) parts.push('hints');
                      if (context) parts.push('context');
                      if (gameCollectPerformance) parts.push('perf');
                      const label = parts.length > 0 ? parts.join(',') : 'default';

                      combinations.push({
                        gameUrl,
                        gameName,
                        options,
                        label,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return combinations;
}

/**
 * Run batch tests with parallel execution
 */
export async function runBatchTests(
  config: BatchTestConfig,
  maxParallel: number = 5
): Promise<BatchTestReport> {
  initConfig();
  initLogger(config.verbose ? 'debug' : 'info');

  const startTime = Date.now();
  const combinations = generateCombinations(config);
  const total = combinations.length;

  logger.info('Starting batch test', {
    totalCombinations: total,
    maxParallel,
    games: config.games.length,
  });

  // Create batch session directory
  const batchId = `batch_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}Z`;
  const batchDir = await createSessionDirectory(
    config.outputDir || 'output',
    `batch-${batchId}`
  );

  const results: Array<{
    gameUrl: string;
    gameName?: string;
    report: QAReport | null;
    error?: string;
    label: string;
    reportId?: string;
  }> = [];

  // Run tests in parallel batches
  for (let i = 0; i < combinations.length; i += maxParallel) {
    const batch = combinations.slice(i, i + maxParallel);
    const batchNumber = Math.floor(i / maxParallel) + 1;
    const totalBatches = Math.ceil(combinations.length / maxParallel);

    logger.info(`Running batch ${batchNumber}/${totalBatches}`, {
      start: i + 1,
      end: Math.min(i + batch.length, combinations.length),
      total: combinations.length,
    });

    const batchPromises = batch.map(async (combo) => {
      // Import browserStorage to wrap each test in its own async context
      const { browserStorage } = await import('./agent/browser.js');
      
      // Generate unique test ID for this parallel test
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Wrap each test in its own async context with the test ID
      // initBrowser() will store the browser instance in a Map keyed by this ID
      return browserStorage.run(testId, async () => {
        try {
          logger.info(`Running test: ${combo.gameUrl} (${combo.label})`);
          const report = await runQA(combo.gameUrl, combo.options);
          
          // Extract report ID from screenshot path (e.g., "output/game_com_2025-11-06T.../screenshots/..." -> "game_com_2025-11-06T...")
          let reportId: string | undefined;
          if (report.screenshots && report.screenshots.length > 0) {
            const firstScreenshot = report.screenshots[0];
            const parts = firstScreenshot.split('/');
            // Find the output directory part (usually the second-to-last before screenshots/)
            const screenshotsIndex = parts.indexOf('screenshots');
            if (screenshotsIndex > 0) {
              reportId = parts[screenshotsIndex - 1];
            }
          }
          
          return {
            gameUrl: combo.gameUrl,
            gameName: combo.gameName,
            report,
            label: combo.label,
            reportId,
          };
        } catch (error) {
          const err = error as Error;
          logger.error(`Test failed: ${combo.gameUrl}`, err, {
            label: combo.label,
          });
          return {
            gameUrl: combo.gameUrl,
            gameName: combo.gameName,
            report: null,
            error: err.message,
            label: combo.label,
            reportId: undefined,
          };
        }
      });
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Cooldown between batches if configured
    if (config.cooldownMs && i + maxParallel < combinations.length) {
      logger.info(`Cooldown: waiting ${config.cooldownMs}ms before next batch`);
      await new Promise((resolve) => setTimeout(resolve, config.cooldownMs!));
    }
  }

  // Calculate summary statistics
  const successfulReports = results.filter((r) => r.report !== null);
  const passed = successfulReports.filter((r) => r.report!.status === 'pass').length;
  const failed = successfulReports.filter((r) => r.report!.status === 'fail').length;
  const errors = successfulReports.filter((r) => r.report!.status === 'error').length;

  const playabilityScores = successfulReports
    .map((r) => r.report!.playability_score)
    .filter((s) => s !== undefined);
  const avgPlayabilityScore =
    playabilityScores.length > 0
      ? playabilityScores.reduce((sum, s) => sum + s, 0) / playabilityScores.length
      : 0;

  const confidenceScores = successfulReports
    .map((r) => r.report!.confidence_score)
    .filter((s) => s !== undefined);
  const avgConfidenceScore =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, s) => sum + s, 0) / confidenceScores.length
      : 0;

  const totalDuration = Date.now() - startTime;

  // Create batch report
  const batchReport: BatchTestReport = {
    batchId,
    timestamp: new Date().toISOString(),
    duration_ms: totalDuration,
    config: {
      games: config.games,
      models: config.models,
      pauseInterval: config.pauseInterval,
      gameSpeed: config.gameSpeed,
      inputHints: config.inputHints ? 'provided' : undefined,
      gameContext: config.gameContext ? 'provided' : undefined,
      quickTest: config.quickTest,
      reasoningEffort: config.reasoningEffort,
      timeout: config.timeout,
      maxActionCount: config.maxActionCount,
      maxParallel,
      cooldownMs: config.cooldownMs,
      collectPerformanceMetrics: config.collectPerformanceMetrics,
    },
    summary: {
      total,
      passed,
      failed,
      errors,
      skipped: results.filter((r) => r.report === null).length,
      avg_playability_score: Math.round(avgPlayabilityScore),
      avg_confidence_score: Math.round(avgConfidenceScore),
      total_duration_ms: totalDuration,
    },
    results: results.map((r) => ({
      gameUrl: r.gameUrl,
      gameName: r.gameName,
      label: r.label,
      report: r.report,
      error: r.error,
      reportId: r.reportId, // Already extracted from screenshot path
    })),
  };

  // Save batch report
  const batchReportPath = joinPath(batchDir, 'batch-report.json');
  await saveJSON(batchReportPath, batchReport);

  logger.info('Batch test complete', {
    batchId,
    total,
    passed,
    failed,
    errors,
    avgScore: avgPlayabilityScore,
    duration: totalDuration,
  });

  return batchReport;
}

