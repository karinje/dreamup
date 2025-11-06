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
import { LLMEvaluation, Screenshot, LogEntry, ControlScheme } from '../types/index.js';
import {
  QA_SYSTEM_PROMPT,
  generatePlayabilityPrompt,
  generateLoadSuccessPrompt,
  generateControlsPrompt,
  generateStabilityPrompt,
  generateGameplayActionPrompt,
  generateInitialNavigationPrompt,
  generateModalDetectionPrompt,
  generateGameStartPrompt,
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
 * Detect and handle modals using LLM
 */
export async function detectModal(
  currentScreenshot: Screenshot
): Promise<{
  has_modal: boolean;
  modal_type: string;
  recommended_action: string;
  confidence: number;
}> {
  logger.info('Using LLM to detect modals');

  try {
    const model = getLLMModel();
    const prompt = generateModalDetectionPrompt();
    const images = await prepareScreenshotsForLLM([currentScreenshot]);

    const result = await generateText({
      model,
      system: 'You are analyzing a browser game interface to detect blocking modals or overlays.',
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
      has_modal: boolean;
      modal_type: string;
      recommended_action: string;
      confidence: number;
    }>(result.text);

    logger.info('LLM modal detection', {
      has_modal: parsed.has_modal,
      modal_type: parsed.modal_type,
      action: parsed.recommended_action,
      confidence: parsed.confidence,
    });

    return parsed;
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to detect modal with LLM', { error: err.message });
    return {
      has_modal: false,
      modal_type: 'none',
      recommended_action: 'none',
      confidence: 0,
    };
  }
}

/**
 * Find how to start the game using LLM
 */
export async function findGameStart(
  currentScreenshot: Screenshot,
  actionHistory: string[]
): Promise<{
  game_state: string;
  start_mechanism: string;
  confidence: number;
}> {
  logger.info('Using LLM to find game start mechanism');

  try {
    const model = getLLMModel();
    const prompt = generateGameStartPrompt(actionHistory);
    const images = await prepareScreenshotsForLLM([currentScreenshot]);

    const result = await generateText({
      model,
      system: 'You are analyzing a browser game to determine how to start playing.',
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
      game_state: string;
      start_mechanism: string;
      confidence: number;
    }>(result.text);

    logger.info('LLM game start detection', {
      game_state: parsed.game_state,
      mechanism: parsed.start_mechanism,
      confidence: parsed.confidence,
    });

    return parsed;
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to find game start with LLM', { error: err.message });
    return {
      game_state: 'unknown',
      start_mechanism: 'Click anywhere to start',
      confidence: 0.1,
    };
  }
}

/**
 * Get LLM analysis of initial page to navigate to gameplay
 */
export async function analyzeInitialNavigation(
  gameUrl: string,
  initialScreenshot: Screenshot
): Promise<{
  has_blocking_modal: boolean;
  modal_description: string;
  recommended_action: string;
  action_target: string;
  reasoning: string;
  confidence: number;
}> {
  logger.info('Getting LLM initial navigation analysis');

  try {
    const model = getLLMModel();
    const prompt = generateInitialNavigationPrompt(gameUrl);
    const images = await prepareScreenshotsForLLM([initialScreenshot]);

    const result = await generateText({
      model,
      system: 'You are an AI QA agent. Analyze the initial page and determine how to get to gameplay.',
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
      has_blocking_modal: boolean;
      modal_description: string;
      recommended_action: string;
      action_target: string;
      reasoning: string;
      confidence: number;
    }>(result.text);

    logger.info('LLM initial navigation analysis', {
      has_modal: parsed.has_blocking_modal,
      action: parsed.recommended_action,
      target: parsed.action_target,
      confidence: parsed.confidence,
    });

    return parsed;
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to get LLM navigation analysis', {
      error: err.message,
    });
    
    // Fallback: assume no modal
    return {
      has_blocking_modal: false,
      modal_description: 'Unable to analyze',
      recommended_action: 'none',
      action_target: '',
      reasoning: 'LLM analysis failed, proceeding without navigation',
      confidence: 0.1,
    };
  }
}

/**
 * Get LLM recommendation for next gameplay action
 */
export async function getGameplayAction(
  gameUrl: string,
  currentScreenshot: Screenshot,
  actionHistory: string[],
  currentPhase: string,
  controlScheme?: ControlScheme | null,
  modelName?: string,
  recentScreenshots?: Screenshot[],
  gameContext?: string,
  reasoningEffort?: 'low' | 'medium' | 'high'
): Promise<{
  keys_to_press: string[];
  reasoning: string;
  confidence: number;
}> {
  logger.info('Getting LLM gameplay recommendation', {
    hasControlScheme: !!controlScheme,
    source: controlScheme?.source,
  });

  try {
    // Use specified model or default to gpt-4o
    const model = openai(modelName || 'gpt-4o');
    
    // Prepare temporal context if we have multiple frames
    const hasTemporalContext = recentScreenshots && recentScreenshots.length > 1;
    const prompt = generateGameplayActionPrompt(gameUrl, actionHistory, currentPhase, controlScheme, hasTemporalContext, gameContext);
    
    // Build image array with temporal labels
    const content: any[] = [];
    
    if (hasTemporalContext) {
      // Add temporal context explanation
      const labels = ['T-2 (oldest)', 'T-1 (previous)', 'T (current)'];
      const framesToSend = recentScreenshots!.slice(-3); // Last 3 frames max
      
      // Extract just the filename for easy reference
      const getFilename = (path: string) => path.split('/').pop() || path;
      
      const stepNumber = actionHistory.length + 1;
      const framesInfo = framesToSend.map((s, idx) => {
        const label = labels[labels.length - framesToSend.length + idx];
        const filename = getFilename(s.path);
        return {
          label: label,
          filename: filename,
          fullPath: s.path,
          fullFilename: filename, // Explicit full filename for clarity
          timestamp: s.timestamp,
        };
      });
      
      // Log each frame separately for clarity
      logger.info(`[STEP ${stepNumber}] Sending ${framesToSend.length} temporal context frames to LLM:`);
      framesInfo.forEach((frame) => {
        logger.info(`  ${frame.label}: ${frame.fullFilename} (full path: ${frame.fullPath})`);
      });
      
      // Also log as structured data
      logger.info(`[STEP ${stepNumber}] Temporal context details:`, {
        step: stepNumber,
        frameCount: framesToSend.length,
        frames: framesInfo,
      });
      
      for (let i = 0; i < framesToSend.length; i++) {
        const label = labels[labels.length - framesToSend.length + i];
        content.push({ type: 'text', text: `\n=== FRAME ${label} ===` });
        const frameImages = await prepareScreenshotsForLLM([framesToSend[i]]);
        content.push(...frameImages);
      }
    } else {
      // Single frame (first turn)
      const getFilename = (path: string) => path.split('/').pop() || path;
      const stepNumber = actionHistory.length + 1;
      const filename = getFilename(currentScreenshot.path);
      logger.info(`[STEP ${stepNumber}] Sending single frame to LLM:`);
      logger.info(`  T (current): ${filename} (full path: ${currentScreenshot.path})`);
      logger.info(`[STEP ${stepNumber}] Single frame details:`, {
        step: stepNumber,
        filename: filename,
        fullFilename: filename,
        fullPath: currentScreenshot.path,
        timestamp: currentScreenshot.timestamp,
      });
      const images = await prepareScreenshotsForLLM([currentScreenshot]);
      content.push(...images);
    }

    // Log what we're sending to LLM for debugging
    const stepNumber = actionHistory.length + 1;
    logger.info(`[STEP ${stepNumber}] LLM input summary:`, {
      step: stepNumber,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 300) + '...',
      imageCount: content.filter((c: any) => c.type === 'image').length,
      hasTemporalContext,
      gameContext: gameContext ? 'present' : 'none',
      actionHistoryLength: actionHistory.length,
      recentActions: actionHistory.slice(-3),
    });

    // Build options object, including reasoning_effort if provided
    const generateOptions: any = {
      model,
      system: 'You are an AI agent playing browser games. Analyze the game and decide the best action to take.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...content,
          ],
        },
      ],
    };
    
    // Add reasoning_effort for gpt-5 and o1 models
    if (reasoningEffort && (modelName === 'gpt-5' || modelName === 'o1' || modelName === 'o1-mini')) {
      generateOptions.reasoning_effort = reasoningEffort;
    }

    const result = await generateText(generateOptions);

    const parsed = parseLLMResponse<{
      game_type: string;
      game_state: string;
      keys_to_press: string[];
      reasoning: string;
      confidence: number;
    }>(result.text);

    logger.info('LLM gameplay recommendation', {
      keys: parsed.keys_to_press,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    });

    return {
      keys_to_press: parsed.keys_to_press || [],
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    };
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to get LLM gameplay recommendation, falling back to defaults', {
      error: err.message,
    });
    
    // Fallback to exploring with arrow keys
    return {
      keys_to_press: ['ArrowUp', 'ArrowRight'],
      reasoning: 'Fallback: exploring with arrow keys',
      confidence: 0.3,
    };
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

