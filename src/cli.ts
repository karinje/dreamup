#!/usr/bin/env node

/**
 * CLI interface for DreamUp QA Agent
 */

import { runQA } from './index.js';

/**
 * Parse command line arguments
 */
const VALID_MODELS = [
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o1-mini',
  'gpt-4-turbo',
  'gpt-4',
] as const;

function parseArgs(): {
  gameUrl: string | null;
  verbose: boolean;
  help: boolean;
  outputDir?: string;
  inputHints?: string;
  inputHintsType?: 'javascript' | 'semantic';
  model?: string;
  gameSpeed?: number;
  pauseInterval?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeout?: number;
  gameContext?: string;
  quickTest?: boolean;
  collectPerformanceMetrics?: boolean;
} {
  const args = process.argv.slice(2);

  const result = {
    gameUrl: null as string | null,
    verbose: false,
    help: false,
    outputDir: undefined as string | undefined,
    inputHints: undefined as string | undefined,
    inputHintsType: 'semantic' as 'javascript' | 'semantic',
    model: undefined as string | undefined,
    gameSpeed: undefined as number | undefined,
    pauseInterval: undefined as number | undefined,
    reasoningEffort: undefined as 'low' | 'medium' | 'high' | undefined,
    timeout: undefined as number | undefined,
    gameContext: undefined as string | undefined,
    quickTest: false,
    collectPerformanceMetrics: undefined as boolean | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--output' || arg === '-o') {
      result.outputDir = args[++i];
    } else if (arg === '--input-hints' || arg === '--hints') {
      result.inputHints = args[++i];
    } else if (arg === '--hints-type') {
      const type = args[++i];
      if (type === 'javascript' || type === 'semantic') {
        result.inputHintsType = type;
      }
    } else if (arg === '--model' || arg === '-m') {
      const modelValue = args[++i];
      if (VALID_MODELS.includes(modelValue as any)) {
        result.model = modelValue;
      } else {
        console.error(`❌ Invalid model: ${modelValue}`);
        console.error(`Valid models: ${VALID_MODELS.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--game-speed' || arg === '--speed') {
      result.gameSpeed = parseFloat(args[++i]);
    } else if (arg === '--pause') {
      result.pauseInterval = parseFloat(args[++i]);
    } else if (arg === '--reasoning-effort') {
      const effort = args[++i];
      if (effort === 'low' || effort === 'medium' || effort === 'high') {
        result.reasoningEffort = effort;
      } else {
        console.error(`❌ Invalid reasoning effort: ${effort}`);
        console.error(`Valid values: low, medium, high`);
        process.exit(1);
      }
    } else if (arg === '--timeout' || arg === '-t') {
      result.timeout = parseInt(args[++i], 10);
    } else if (arg === '--game-context' || arg === '--context') {
      result.gameContext = args[++i];
    } else if (arg === '--quick-test') {
      result.quickTest = true;
    } else if (arg === '--collect-performance') {
      result.collectPerformanceMetrics = true;
    } else if (!arg.startsWith('-') && !result.gameUrl) {
      result.gameUrl = arg;
    }
  }

  // Validate mutual exclusivity
  if (result.gameSpeed !== undefined && result.pauseInterval !== undefined) {
    console.error('❌ Error: Cannot use both --speed and --pause flags together');
    console.error('   Use --speed for URL-based speed control OR --pause for pause-step mode');
    process.exit(1);
  }

  // Validate quick-test mode restrictions
  if (result.quickTest) {
    if (result.pauseInterval !== undefined) {
      console.error('❌ Error: Cannot use --quick-test with --pause');
      console.error('   Quick test mode is for fast functional testing without LLM');
      process.exit(1);
    }
    if (result.gameSpeed !== undefined) {
      console.error('❌ Error: Cannot use --quick-test with --speed');
      console.error('   Quick test mode is for fast functional testing without LLM');
      process.exit(1);
    }
    if (result.model !== undefined) {
      console.error('❌ Error: Cannot use --quick-test with --model');
      console.error('   Quick test mode does not use LLM');
      process.exit(1);
    }
    // Set default timeout for quick test if not specified
    if (result.timeout === undefined) {
      result.timeout = 60000; // 60 seconds default for quick test
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
  --hints <text>          Input control hints (semantic description or JS snippet)
  --hints-type <type>     Hints type: 'semantic' or 'javascript' (default: semantic)
  -m, --model <name>      LLM model (default: gpt-4o)
                          Options: gpt-5, gpt-4o, gpt-4o-mini, o1, o1-mini, gpt-4-turbo, gpt-4
  --speed <number>        Game speed multiplier (default: 1.0)
                          Examples: 0.1 (10% speed), 0.5 (50%), 2.0 (200%)
                          (Cannot be used with --pause)
  --pause <seconds>       Pause-step mode: pause game every X seconds for LLM decision
                          Examples: 0.5 (pause every 500ms), 1.0 (every 1s)
                          (Cannot be used with --speed. Only works with DreamUp games)
  -t, --timeout <ms>      Test execution timeout in milliseconds (default: 300000 = 5 min)
                          Examples: 60000 (1 min), 120000 (2 min), 600000 (10 min)
  --context <text>        Game-specific context for the AI (paddle position, objectives, etc.)
                          Example: "You control the RIGHT paddle. Move to intercept the ball."
  --quick-test            Fast functional test mode - press all hint keys without LLM
                          (Default timeout: 60s. Cannot be used with --pause, --speed, --model)
  --reasoning-effort <level>  Reasoning effort level for gpt-5 and o1 models
                          Options: low, medium, high (default: medium)
                          Example: --model gpt-5 --reasoning-effort high
  --collect-performance    Capture performance metrics (load timing, FPS, latency)
                          Disabled by default
  -h, --help              Show this help message

Examples:
  # Basic usage
  qa-agent https://example.com/game
  
  # With verbose logging
  qa-agent https://example.com/game --verbose
  
  # With semantic input hints
  qa-agent https://2048game.com --hints "Use arrow keys to move tiles"
  
  # With JavaScript input hints
  qa-agent https://game.com --hints "createAction('Jump').bindKey(' ')" --hints-type javascript
  
  # Use faster/cheaper model with slower game speed
  qa-agent https://game.com --model gpt-4o-mini --speed 0.2
  
  # Use pause-step mode for DreamUp games (perfect synchronization)
  qa-agent https://localhost:8080/snake/ --pause 0.5 --hints "..."
  
  # Quick functional test (30s, no LLM)
  qa-agent https://game.com --hints "..." --quick-test
  
  # Use gpt-5 with high reasoning effort
  qa-agent https://game.com --model gpt-5 --reasoning-effort high
  
  # Use o1 model with medium reasoning effort
  qa-agent https://game.com --model o1 --reasoning-effort medium

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
  if (args.quickTest) {
    console.log(`Mode: Quick Test (functional verification, no LLM)`);
  }
  if (args.inputHints) {
    console.log(`Control Hints: ${args.inputHintsType} format`);
  }
  if (args.model && !args.quickTest) {
    const reasoningInfo = args.reasoningEffort ? ` (reasoning effort: ${args.reasoningEffort})` : '';
    console.log(`LLM Model: ${args.model || 'gpt-4o'}${reasoningInfo}`);
  }
  if (args.gameSpeed) {
    console.log(`Game Speed: ${args.gameSpeed * 100}%`);
  }
  if (args.pauseInterval) {
    console.log(`Pause Mode: Every ${args.pauseInterval}s (pause-step synchronization)`);
  }
  if (args.timeout) {
    console.log(`Timeout: ${args.timeout}ms (${(args.timeout / 1000).toFixed(1)}s)`);
  }
  if (args.gameContext && !args.quickTest) {
    console.log(`Game Context: ${args.gameContext.substring(0, 60)}${args.gameContext.length > 60 ? '...' : ''}`);
  }
  if (args.collectPerformanceMetrics) {
    console.log(`Performance Metrics: Enabled`);
  }

  try {
    printProgress('Initializing browser');

    // Add speed parameter to URL if specified
    let gameUrl = args.gameUrl;
    if (args.gameSpeed !== undefined) {
      const url = new URL(gameUrl);
      url.searchParams.set('speed', args.gameSpeed.toString());
      gameUrl = url.toString();
    }

    // Add pauseMode parameter to URL if pause interval specified
    if (args.pauseInterval !== undefined) {
      const url = new URL(gameUrl);
      url.searchParams.set('pauseMode', 'true');
      gameUrl = url.toString();
    }

    const report = await runQA(gameUrl, {
      verbose: args.verbose,
      outputDir: args.outputDir,
      inputHints: args.inputHints
        ? {
            type: args.inputHintsType!,
            content: args.inputHints,
          }
        : undefined,
      model: args.model,
      pauseInterval: args.pauseInterval,
      maxExecutionTime: args.timeout,
      gameContext: args.gameContext,
      quickTest: args.quickTest,
      reasoningEffort: args.reasoningEffort,
      collectPerformanceMetrics: args.collectPerformanceMetrics,
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

