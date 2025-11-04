#!/usr/bin/env node

/**
 * CLI interface for DreamUp QA Agent
 */

import { runQA } from './index.js';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  gameUrl: string | null;
  verbose: boolean;
  help: boolean;
  outputDir?: string;
} {
  const args = process.argv.slice(2);

  const result = {
    gameUrl: null as string | null,
    verbose: false,
    help: false,
    outputDir: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--output' || arg === '-o') {
      result.outputDir = args[++i];
    } else if (!arg.startsWith('-') && !result.gameUrl) {
      result.gameUrl = arg;
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
DreamUp QA Agent - Autonomous Browser Game Testing

Usage:
  qa-agent <game-url> [options]

Arguments:
  <game-url>              URL of the browser game to test

Options:
  -v, --verbose           Enable verbose logging
  -o, --output <dir>      Output directory for test artifacts
  -h, --help              Show this help message

Examples:
  qa-agent https://example.com/game
  qa-agent https://example.com/game --verbose
  qa-agent https://example.com/game --output ./test-results

Environment Variables:
  See .env.example for required configuration

For more information, visit: https://github.com/yourusername/dreamup-qa-agent
`);
}

/**
 * Print test progress
 */
function printProgress(message: string): void {
  console.log(`\n🤖 ${message}...`);
}

/**
 * Print test results
 */
function printResults(report: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('QA TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`\nStatus: ${getStatusEmoji(report.status)} ${report.status.toUpperCase()}`);
  console.log(`Playability Score: ${report.playability_score}/100`);
  console.log(`Confidence: ${report.confidence_score}%`);
  console.log(`\nDuration: ${(report.metadata.duration_ms / 1000).toFixed(1)}s`);
  console.log(`Screenshots: ${report.screenshots.length}`);
  console.log(`Issues Found: ${report.issues.length}`);

  if (report.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of report.issues) {
      const severitySymbol = getSeveritySymbol(issue.severity);
      console.log(`  ${severitySymbol} [${issue.severity.toUpperCase()}] ${issue.description}`);
    }
  }

  console.log(`\nOutput Directory: ${report.metadata.game_url}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'fail':
      return '⚠️';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

/**
 * Get severity symbol
 */
function getSeveritySymbol(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.gameUrl) {
    console.error('❌ Error: Game URL is required\n');
    printHelp();
    process.exit(1);
  }

  console.log('🎮 DreamUp QA Agent');
  console.log('='.repeat(60));
  console.log(`Testing: ${args.gameUrl}`);

  try {
    printProgress('Initializing browser');

    const report = await runQA(args.gameUrl, {
      verbose: args.verbose,
      outputDir: args.outputDir,
    });

    printResults(report);

    // Exit with appropriate code
    process.exit(report.status === 'pass' ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test execution failed:');
    console.error((error as Error).message);

    if (args.verbose) {
      console.error('\nStack trace:');
      console.error((error as Error).stack);
    }

    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(130);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled rejection:', reason);
  process.exit(1);
});

// Run CLI
main();

