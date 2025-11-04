/**
 * LLM-based game analysis
 */

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { EvaluationError } from '../utils/errors.js';
import { screenshotToBase64 } from '../evidence/screenshots.js';
import { LLMEvaluation, Screenshot, LogEntry } from '../types/index.js';
import {
  QA_SYSTEM_PROMPT,
  generatePlayabilityPrompt,
  generateLoadSuccessPrompt,
  generateControlsPrompt,
  generateStabilityPrompt,
} from './prompts.js';

/**
 * Get LLM model instance based on configuration
 */
function getLLMModel() {
  const config = getConfig();

  switch (config.llmProvider) {
    case 'openai':
      return openai(config.llmModel);
    case 'anthropic':
      return anthropic(config.llmModel);
    case 'groq':
      // Groq uses OpenAI-compatible API
      return openai(config.llmModel);
    default:
      throw new EvaluationError(`Unsupported LLM provider: ${config.llmProvider}`);
  }
}

/**
 * Convert screenshots to base64 images for LLM
 */
async function prepareScreenshotsForLLM(screenshots: Screenshot[]): Promise<Array<{
  type: 'image';
  image: string;
}>> {
  const images = [];

  for (const screenshot of screenshots) {
    try {
      const base64 = await screenshotToBase64(screenshot.path);
      images.push({
        type: 'image' as const,
        image: base64,
      });
    } catch (error) {
      logger.warn('Failed to load screenshot for LLM', {
        path: screenshot.path,
        error: (error as Error).message,
      });
    }
  }

  return images;
}

/**
 * Parse LLM response as JSON
 */
function parseLLMResponse<T>(response: string): T {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonStr) as T;
  } catch (error) {
    logger.error('Failed to parse LLM response as JSON', error as Error, {
      response: response.substring(0, 200),
    });
    throw new EvaluationError('LLM returned invalid JSON response');
  }
}

/**
 * Evaluate game load success
 */
export async function evaluateLoadSuccess(
  gameUrl: string,
  screenshots: Screenshot[]
): Promise<{ success: boolean; confidence: number; observations: string[] }> {
  logger.info('Evaluating game load success');

  try {
    const model = getLLMModel();
    const prompt = generateLoadSuccessPrompt(gameUrl);
    const images = await prepareScreenshotsForLLM(screenshots.slice(0, 2)); // First 2 screenshots

    const result = await generateText({
      model,
      system: QA_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images,
          ],
        },
      ],
    });

    const parsed = parseLLMResponse<{
      loaded_successfully: boolean;
      confidence: number;
      observations: string[];
    }>(result.text);

    logger.info('Load success evaluation complete', {
      success: parsed.loaded_successfully,
      confidence: parsed.confidence,
    });

    return {
      success: parsed.loaded_successfully,
      confidence: parsed.confidence,
      observations: parsed.observations,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Load success evaluation failed', err);
    throw new EvaluationError(`Load evaluation failed: ${err.message}`);
  }
}

/**
 * Evaluate control responsiveness
 */
export async function evaluateControls(
  screenshots: Screenshot[],
  actionHistory: string[],
  logs: LogEntry[]
): Promise<{ responsive: boolean; confidence: number; observations: string[] }> {
  logger.info('Evaluating control responsiveness');

  try {
    const model = getLLMModel();
    const prompt = generateControlsPrompt(actionHistory, logs);
    const images = await prepareScreenshotsForLLM(screenshots); // All screenshots

    const result = await generateText({
      model,
      system: QA_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images,
          ],
        },
      ],
    });

    const parsed = parseLLMResponse<{
      controls_responsive: boolean;
      confidence: number;
      observations: string[];
    }>(result.text);

    logger.info('Controls evaluation complete', {
      responsive: parsed.controls_responsive,
      confidence: parsed.confidence,
    });

    return {
      responsive: parsed.controls_responsive,
      confidence: parsed.confidence,
      observations: parsed.observations,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Controls evaluation failed', err);
    throw new EvaluationError(`Controls evaluation failed: ${err.message}`);
  }
}

/**
 * Evaluate game stability
 */
export async function evaluateStability(
  duration: number,
  errorLogs: LogEntry[],
  phases: string[]
): Promise<{ stable: boolean; confidence: number; observations: string[] }> {
  logger.info('Evaluating game stability');

  try {
    const model = getLLMModel();
    const prompt = generateStabilityPrompt(duration, errorLogs, phases as any[]);

    const result = await generateText({
      model,
      system: QA_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const parsed = parseLLMResponse<{
      game_stable: boolean;
      confidence: number;
      observations: string[];
    }>(result.text);

    logger.info('Stability evaluation complete', {
      stable: parsed.game_stable,
      confidence: parsed.confidence,
    });

    return {
      stable: parsed.game_stable,
      confidence: parsed.confidence,
      observations: parsed.observations,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Stability evaluation failed', err);
    throw new EvaluationError(`Stability evaluation failed: ${err.message}`);
  }
}

/**
 * Comprehensive playability evaluation
 */
export async function evaluatePlayability(
  gameUrl: string,
  screenshots: Screenshot[],
  actionHistory: string[],
  logs: LogEntry[],
  phases: string[],
  duration: number
): Promise<LLMEvaluation> {
  logger.info('Running comprehensive playability evaluation');

  try {
    const model = getLLMModel();
    const prompt = generatePlayabilityPrompt(gameUrl, duration, actionHistory, logs, phases as any[]);

    // Select representative screenshots (max 5 to avoid token limits)
    const selectedScreenshots = selectRepresentativeScreenshots(screenshots, 5);
    const images = await prepareScreenshotsForLLM(selectedScreenshots);

    const result = await generateText({
      model,
      system: QA_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images,
          ],
        },
      ],
    });

    const parsed = parseLLMResponse<LLMEvaluation>(result.text);

    logger.info('Playability evaluation complete', {
      loaded: parsed.loaded_successfully,
      responsive: parsed.controls_responsive,
      stable: parsed.game_stable,
      confidence: parsed.confidence,
    });

    return parsed;
  } catch (error) {
    const err = error as Error;
    logger.error('Playability evaluation failed', err);
    throw new EvaluationError(`Playability evaluation failed: ${err.message}`);
  }
}

/**
 * Select representative screenshots to avoid overwhelming the LLM
 */
function selectRepresentativeScreenshots(screenshots: Screenshot[], maxCount: number): Screenshot[] {
  if (screenshots.length <= maxCount) {
    return screenshots;
  }

  const selected: Screenshot[] = [];

  // Always include first screenshot
  selected.push(screenshots[0]);

  // Include last screenshot
  selected.push(screenshots[screenshots.length - 1]);

  // Evenly space remaining screenshots
  const remaining = maxCount - 2;
  const step = Math.floor((screenshots.length - 2) / remaining);

  for (let i = 1; i < remaining + 1; i++) {
    const index = i * step;
    if (index < screenshots.length - 1) {
      selected.push(screenshots[index]);
    }
  }

  return selected.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

