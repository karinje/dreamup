/**
 * Configuration management from environment variables
 */

import { AgentConfig, LLMProvider, LogLevel } from '../types/index.js';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

/**
 * Validates required environment variables
 */
function validateEnv(): void {
  const required = ['BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID'];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate LLM configuration
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProvider;

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is openai');
  }

  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER is anthropic');
  }

  if (provider === 'groq' && !process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required when LLM_PROVIDER is groq');
  }
}

/**
 * Parses a number from environment variable with default
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parses a boolean from environment variable with default
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Loads configuration from environment variables
 */
export function loadConfig(): AgentConfig {
  validateEnv();

  const config: AgentConfig = {
    // Browser
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY!,
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID!,

    // LLM
    llmProvider: (process.env.LLM_PROVIDER || 'openai') as LLMProvider,
    llmModel: process.env.LLM_MODEL || 'gpt-4o',
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,

    // Timeouts & Limits
    maxExecutionTime: parseNumber(process.env.MAX_EXECUTION_TIME_MS, 300000), // 5 minutes
    maxActionCount: parseNumber(process.env.MAX_ACTION_COUNT, 100),
    retryAttempts: parseNumber(process.env.RETRY_ATTEMPTS, 3),
    screenshotCount: parseNumber(process.env.SCREENSHOT_COUNT, 5),
    timeoutPageLoad: parseNumber(process.env.TIMEOUT_PAGE_LOAD_MS, 60000), // 60 seconds

    // Output
    outputDir: process.env.OUTPUT_DIR || './output',
    logLevel: (process.env.LOG_LEVEL || 'info') as LogLevel,

    // Optional
    enableGifRecording: parseBoolean(process.env.ENABLE_GIF_RECORDING, true), // Default to true for testing
    gifMaxDuration: parseNumber(process.env.GIF_MAX_DURATION_SEC, 60), // Increased to 60s for slow games
  };

  return config;
}

/**
 * Global configuration instance
 */
export let config: AgentConfig;

/**
 * Initializes the configuration (call this at startup)
 */
export function initConfig(): void {
  config = loadConfig();
}

/**
 * Gets the current configuration (throws if not initialized)
 */
export function getConfig(): AgentConfig {
  if (!config) {
    throw new Error('Configuration not initialized. Call initConfig() first.');
  }
  return config;
}

/**
 * Default configuration values for reference
 */
export const DEFAULT_CONFIG = {
  maxExecutionTime: 300000,
  maxActionCount: 100,
  retryAttempts: 3,
  screenshotCount: 5,
  timeoutPageLoad: 60000,
  outputDir: './output',
  logLevel: 'info' as LogLevel,
  enableGifRecording: false,
  gifMaxDuration: 30,
} as const;

