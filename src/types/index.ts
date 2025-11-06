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
  llm_action?: string;      // Keys pressed after this screenshot (e.g., "ArrowUp, ArrowRight")
  llm_reasoning?: string;   // LLM's reasoning for the action
  temporal_context?: {      // Screenshots sent to LLM along with this one (for debugging)
    t_minus_2?: string;     // Path to T-2 frame (oldest)
    t_minus_1?: string;     // Path to T-1 frame (previous)
    t_current: string;      // Path to T frame (current) - this screenshot
  };
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
  reasoning_effort?: 'low' | 'medium' | 'high';
  test_config?: {
    pause_interval?: number;
    game_speed?: number;
    timeout_ms?: number;
    has_game_context?: boolean;
    game_context?: string;
    has_input_hints?: boolean;
    quick_test?: boolean;
  };
}

/**
 * Score breakdown details
 */
export interface ScoreBreakdown {
  base_scores: {
    load_success: number;
    controls: number;
    stability: number;
    ui_visibility: number;
  };
  total_base: number;
  issue_penalties: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  after_penalties: number;
  confidence_factor: number;
  final_score: number;
}

/**
 * Main QA report structure
 */
export interface QAReport {
  status: TestStatus;
  playability_score: number;
  confidence_score: number;
  score_breakdown?: ScoreBreakdown;
  issues: Issue[];
  observations?: string[];
  screenshots: string[];  // Deprecated: use screenshot_metadata instead
  screenshot_metadata?: Screenshot[];  // Full screenshot metadata with LLM actions
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
  inputHints?: InputHints;
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
 * Input control hints for guiding QA testing
 */
export interface InputHints {
  type: 'javascript' | 'semantic';
  content: string;
}

/**
 * Parsed control scheme from input hints
 */
export interface ControlScheme {
  actions: Array<{
    name: string;
    keys: string[];
    buttons?: string[];
  }>;
  axes: Array<{
    name: string;
    type: '1d' | '2d';
    keys: string[];
    bindings?: string[];
  }>;
  source: 'hints' | 'auto-detected';
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
  inputHints?: InputHints;
  model?: string;
  pauseInterval?: number; // Pause game every X seconds (pause-step mode)
  gameSpeed?: number; // Game speed percentage (for ?speed=X or ?testMode=true)
  gameContext?: string; // Game-specific context/instructions for the AI
  quickTest?: boolean; // Fast functional test mode - press all keys without LLM
  reasoningEffort?: 'low' | 'medium' | 'high'; // Reasoning effort for gpt-5 and o1 models
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

