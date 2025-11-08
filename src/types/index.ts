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
    collect_performance_metrics?: boolean;
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

export type PerformanceMode = 'normal' | 'pause' | 'quick';

export interface NavigationPerformance {
  timeToFirstByte?: number;
  domContentLoaded?: number;
  firstPaint?: number | null;
  firstContentfulPaint?: number | null;
  loadEvent?: number;
}

export interface FpsPerformance {
  average?: number | null;
  minimum?: number | null;
  maximum?: number | null;
  samplesCollected: number;
  droppedFrames: number;
}

export interface LongTaskPerformance {
  count: number;
  totalBlockingTime: number;
}

export interface SlowResourceTiming {
  name: string;
  duration: number;
  transferSize?: number;
  initiatorType?: string;
  encodedBodySize?: number;
}

export interface InteractionSampleSummary {
  label: string;
  durationMs: number;
  keys?: string[];
  timestamp: number;
}

export interface InteractionLatencyMetrics {
  sampleCount: number;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  samples: InteractionSampleSummary[];
}

export interface MemoryUsageMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceMetrics {
  mode?: PerformanceMode | 'unknown';
  navigation?: NavigationPerformance;
  fps?: FpsPerformance;
  longTasks?: LongTaskPerformance;
  slowResources?: SlowResourceTiming[];
  interactionLatency?: InteractionLatencyMetrics;
  consoleErrors?: number;
  memory?: MemoryUsageMetrics | null;
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
  performance?: PerformanceMetrics;
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
  collectPerformanceMetrics?: boolean;
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
  collectPerformanceMetrics: boolean;
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
  collectPerformanceMetrics?: boolean; // Toggle collection of performance telemetry
}

/**
 * Per-game configuration for batch testing
 * All fields are optional - if not specified, uses global defaults from BatchTestConfig
 */
export interface BatchGameConfig {
  url: string;
  name?: string;
  
  // Per-game overrides (take priority over global defaults)
  inputHints?: InputHints;
  gameContext?: string;
  model?: string;
  pauseInterval?: number;
  gameSpeed?: number;
  quickTest?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeout?: number;
  maxActionCount?: number;
  collectPerformanceMetrics?: boolean;
}

/**
 * Batch test configuration
 * Supports arrays for all options to generate combinations
 * Games can have per-game config (inputHints, gameContext) or use global arrays
 */
export interface BatchTestConfig {
  // Games to test (required)
  // Can be URLs (string) or game config objects with per-game settings
  games: Array<string | BatchGameConfig>;
  
  // Options that can be arrays to generate combinations
  models?: string[];
  pauseInterval?: number[];
  gameSpeed?: number[];
  inputHints?: Array<InputHints | undefined>; // Global hints (used if game doesn't have its own)
  gameContext?: Array<string | undefined>; // Global context (used if game doesn't have its own)
  quickTest?: boolean; // Single value (true/false) or omit for both
  reasoningEffort?: Array<'low' | 'medium' | 'high' | undefined>;
  timeout?: number[];
  maxActionCount?: number[];
  
  // Batch execution settings
  maxParallel?: number; // Max parallel browsers (default: 5)
  cooldownMs?: number; // Cooldown between batches
  continueOnError?: boolean; // Continue if individual test fails
  verbose?: boolean;
  outputDir?: string;
  collectPerformanceMetrics?: boolean;
}

/**
 * Batch test results
 */
export interface BatchTestReport {
  batchId: string;
  timestamp: string;
  duration_ms: number;
  config: {
    games: Array<string | BatchGameConfig>;
    models?: string[];
    pauseInterval?: number[];
    gameSpeed?: number[];
    inputHints?: string; // 'provided' if any hints were used
    gameContext?: string; // 'provided' if any context was used
    quickTest?: boolean;
    reasoningEffort?: Array<'low' | 'medium' | 'high' | undefined>;
    timeout?: number[];
    maxActionCount?: number[];
    maxParallel: number;
    cooldownMs?: number;
    collectPerformanceMetrics?: boolean;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    avg_playability_score: number;
    avg_confidence_score: number;
    total_duration_ms: number;
  };
  results: Array<{
    gameUrl: string;
    gameName?: string;
    label: string; // Combination label (e.g., "model:gpt-4o,pause:0.5,quick")
    report: QAReport | null;
    error?: string;
    reportId?: string; // Reference to individual report directory
  }>;
}

