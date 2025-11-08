#!/usr/bin/env node

/**
 * CLI for Batch Testing
 * Usage: npx tsx src/batch-cli.ts <config-file.json>
 */

import { readFile } from 'fs/promises';
import { runBatchTests } from '../src/batch.js';
import { BatchTestConfig } from '../src/types/index.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
DreamUp QA Agent - Batch Testing

Usage:
  npx tsx src/batch-cli.ts <config-file.json>

Example config file:
  {
    "games": [
      "https://game1.com",
      { "url": "https://game2.com", "name": "Game 2" }
    ],
    "models": ["gpt-4o", "gpt-4o-mini"],
    "pauseInterval": [0.5, 1.0],
    "quickTest": true,
    "maxParallel": 5,
    "cooldownMs": 1000
  }

This will test all combinations:
  - 2 games × 2 models × 2 pause intervals × 1 quickTest = 8 total tests

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose logging

See examples/batch-config.example.json for a complete example.
`);
    process.exit(0);
  }

  const configPath = args[0];
  const verbose = args.includes('--verbose') || args.includes('-v');

  try {
    // Read and parse config file
    const configData = await readFile(configPath, 'utf-8');
    const config: BatchTestConfig = JSON.parse(configData);

    // Add verbose flag if provided
    if (verbose) {
      config.verbose = true;
    }

    // Validate config
    if (!config.games || config.games.length === 0) {
      throw new Error('Config must include at least one game URL');
    }

    // Calculate total combinations
    const totalCombinations = calculateTotalCombinations(config);
    console.log(`\n📊 Batch Test Configuration:`);
    console.log(`   Games: ${config.games.length}`);
    console.log(`   Total combinations: ${totalCombinations}`);
    console.log(`   Max parallel: ${config.maxParallel || 5}`);
    console.log(`\n🚀 Starting batch test...\n`);

    // Run batch tests
    const batchReport = await runBatchTests(config, config.maxParallel || 5);

    // Print summary
    console.log(`\n✅ Batch test complete!\n`);
    console.log(`Summary:`);
    console.log(`  Total tests: ${batchReport.summary.total}`);
    console.log(`  Passed: ${batchReport.summary.passed}`);
    console.log(`  Failed: ${batchReport.summary.failed}`);
    console.log(`  Errors: ${batchReport.summary.errors}`);
    console.log(`  Skipped: ${batchReport.summary.skipped}`);
    console.log(`  Avg Score: ${batchReport.summary.avg_playability_score}/100`);
    console.log(`  Duration: ${(batchReport.summary.total_duration_ms / 1000).toFixed(1)}s`);
    console.log(`\n📁 Batch report saved to: output/${batchReport.batchId}/batch-report.json`);
    console.log(`\n🌐 View in dashboard: http://localhost:3001\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}\n`);
    if ((error as Error).stack) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

function calculateTotalCombinations(config: BatchTestConfig): number {
  const games = config.games.length;
  const models = config.models?.length || 1;
  const pauseIntervals = config.pauseInterval?.length || 1;
  const gameSpeeds = config.gameSpeed?.length || 1;
  const inputHints = config.inputHints?.length || 1;
  const gameContexts = config.gameContext?.length || 1;
  const quickTests = config.quickTest !== undefined ? 1 : 2;
  const reasoningEfforts = config.reasoningEffort?.length || 1;
  const timeouts = config.timeout?.length || 1;
  const maxActionCounts = config.maxActionCount?.length || 1;

  return (
    games *
    models *
    pauseIntervals *
    gameSpeeds *
    inputHints *
    gameContexts *
    quickTests *
    reasoningEfforts *
    timeouts *
    maxActionCounts
  );
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

