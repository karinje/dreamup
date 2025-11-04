/**
 * Core type definitions for the DreamUp QA Agent
 */

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Issue categories
 */
export type IssueCategory = 'load' | 'controls' | 'stability' | 'ui' | 'other';

/**
 * Test execution status
 */
export type TestStatus = 'pass' | 'fail' | 'error';

/**
 * Log levels for structured logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * LLM provider options
 */
export type LLMProvider = 'openai' | 'anthropic' | 'groq';

/**
 * Game state phases during testing
 */
export type GamePhase =
  | 'loading'
  | 'start_screen'
  | 'gameplay'
  | 'game_over'
  | 'completed'
  | 'stuck'
  | 'crashed';

/**
 * Represents a single issue found during testing
 */
export interface Issue {
  severity: IssueSeverity;
  description: string;
  category: IssueCategory;
  timestamp: string;
  screenshot?: string;
}

/**
 * Screenshot metadata
 */
export interface Screenshot {
  path: string;
  timestamp: string;
  action?: string;
  phase?: GamePhase;
}

/**
 * Console log entry
 */
export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Browser viewport configuration
 */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * Test execution metadata
 */
export interface TestMetadata {
  game_url: string;
  timestamp: string;
  duration_ms: number;
  browser: string;
  viewport: Viewport;
  llm_provider: string;
  llm_model: string;
}

/**
 * Main QA report structure
 */
export interface QAReport {
  status: TestStatus;
  playability_score: number;
  confidence_score: number;
  issues: Issue[];
  screenshots: string[];
  logs: string[];
  metadata: TestMetadata;
  gif?: string;
}

/**
 * Configuration for a single test run
 */
export interface TestConfig {
  gameUrl: string;
  maxExecutionTime?: number;
  maxActionCount?: number;
  retryAttempts?: number;
  screenshotCount?: number;
  timeoutPageLoad?: number;
  outputDir?: string;
  verbose?: boolean;
  enableGifRecording?: boolean;
  gifMaxDuration?: number;
}

/**
 * Result of a single action performed during testing
 */
export interface ActionResult {
  success: boolean;
  action: string;
  timestamp: string;
  screenshot?: string;
  error?: string;
  phase: GamePhase;
}

/**
 * Current state of the game during testing
 */
export interface GameState {
  phase: GamePhase;
  actionCount: number;
  startTime: number;
  lastActionTime: number;
  screenshots: Screenshot[];
  logs: LogEntry[];
  errors: string[];
  actionHistory: string[];
}

/**
 * LLM evaluation response structure
 */
export interface LLMEvaluation {
  loaded_successfully: boolean;
  controls_responsive: boolean;
  game_stable: boolean;
  ui_visible: boolean;
  confidence: number;
  observations: string[];
  issues: string[];
}

/**
 * Prompt context for LLM evaluation
 */
export interface EvaluationContext {
  screenshots: Screenshot[];
  logs: LogEntry[];
  actionHistory: string[];
  gameUrl: string;
  duration: number;
}

/**
 * Configuration loaded from environment
 */
export interface AgentConfig {
  // Browser
  browserbaseApiKey: string;
  browserbaseProjectId: string;

  // LLM
  llmProvider: LLMProvider;
  llmModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;

  // Timeouts & Limits
  maxExecutionTime: number;
  maxActionCount: number;
  retryAttempts: number;
  screenshotCount: number;
  timeoutPageLoad: number;

  // Output
  outputDir: string;
  logLevel: LogLevel;

  // Optional
  enableGifRecording: boolean;
  gifMaxDuration: number;
}

/**
 * Options for the programmatic API
 */
export interface QAOptions {
  maxExecutionTime?: number;
  maxActionCount?: number;
  screenshotCount?: number;
  verbose?: boolean;
  outputDir?: string;
}

/**
 * Batch test configuration
 */
export interface BatchTestConfig {
  games: Array<{
    url: string;
    name?: string;
  }>;
  cooldownMs?: number;
  continueOnError?: boolean;
}

/**
 * Batch test results
 */
export interface BatchTestReport {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  reports: Array<{
    gameUrl: string;
    gameName?: string;
    report: QAReport;
  }>;
  summary: {
    avg_playability_score: number;
    avg_confidence_score: number;
    total_duration_ms: number;
  };
}

