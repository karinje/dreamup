/**
 * Evaluation prompt templates
 */

import { LogEntry, GamePhase } from '../types/index.js';

/**
 * Generate prompt for load success evaluation
 */
export function generateLoadSuccessPrompt(gameUrl: string): string {
  return `You are evaluating whether a browser game loaded successfully.

Game URL: ${gameUrl}

Analyze the screenshot(s) provided and determine if the game loaded properly.

Look for:
- Visible game interface or canvas
- Game menu or start screen
- Loading indicators (completed or still loading)
- Error messages or blank screens
- Proper rendering of game elements

Respond with a JSON object in this exact format:
{
  "loaded_successfully": true/false,
  "confidence": 0.0-1.0,
  "observations": ["list", "of", "what you see"],
  "issues": ["any problems detected"]
}`;
}

/**
 * Generate prompt for control responsiveness evaluation
 */
export function generateControlsPrompt(
  actionHistory: string[],
  logs: LogEntry[]
): string {
  return `You are evaluating whether a browser game has responsive controls.

Action History:
${actionHistory.map((action, i) => `${i + 1}. ${action}`).join('\n')}

Console Errors: ${logs.filter((l) => l.level === 'error').length}

Analyze the sequence of screenshots showing gameplay and determine if controls are responsive.

Look for:
- Visible changes between screenshots indicating game state updates
- Evidence that player input affected the game
- Smooth transitions and responsiveness
- Lack of frozen or static screens
- No control-related errors

Respond with a JSON object:
{
  "controls_responsive": true/false,
  "confidence": 0.0-1.0,
  "observations": ["what you noticed about interactivity"],
  "issues": ["any control problems"]
}`;
}

/**
 * Generate prompt for stability evaluation
 */
export function generateStabilityPrompt(
  duration: number,
  errorLogs: LogEntry[],
  phases: GamePhase[]
): string {
  return `You are evaluating the stability of a browser game.

Test Duration: ${duration}ms
Console Errors: ${errorLogs.length}
Game Phases Detected: ${phases.join(' → ')}

Top Errors:
${errorLogs
  .slice(0, 5)
  .map((log) => `- ${log.message}`)
  .join('\n')}

Analyze if the game ran stably without crashes or major issues.

Look for:
- Game remained functional throughout
- No crash indicators or blank screens
- Reasonable error levels (some errors are normal)
- Smooth phase transitions
- No frozen or stuck states

Respond with a JSON object:
{
  "game_stable": true/false,
  "confidence": 0.0-1.0,
  "observations": ["stability indicators"],
  "issues": ["any stability problems"]
}`;
}

/**
 * Generate comprehensive playability prompt
 */
export function generatePlayabilityPrompt(
  gameUrl: string,
  duration: number,
  actionHistory: string[],
  logs: LogEntry[],
  phases: GamePhase[]
): string {
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warningCount = logs.filter((l) => l.level === 'warn').length;

  return `You are a QA expert evaluating the overall playability of a browser game.

Game URL: ${gameUrl}
Test Duration: ${(duration / 1000).toFixed(1)}s
Actions Performed: ${actionHistory.length}
Console Errors: ${errorCount}
Console Warnings: ${warningCount}
Game Phases: ${phases.join(' → ')}

Recent Actions:
${actionHistory.slice(-10).map((action, i) => `${i + 1}. ${action}`).join('\n')}

Recent Errors:
${logs
  .filter((l) => l.level === 'error')
  .slice(-5)
  .map((log) => `- ${log.message}`)
  .join('\n') || 'None'}

Based on the screenshots and logs, evaluate:
1. Did the game load successfully?
2. Is the game interface visible and properly rendered?
3. Do controls respond to user input?
4. Did the game remain stable without crashing?
5. Is the game in a playable state?

Provide a comprehensive assessment in JSON format:
{
  "loaded_successfully": true/false,
  "ui_visible": true/false,
  "controls_responsive": true/false,
  "game_stable": true/false,
  "confidence": 0.0-1.0,
  "observations": [
    "specific observations about what you see",
    "evidence of functionality or issues"
  ],
  "issues": [
    "any problems that impact playability",
    "critical bugs or failures"
  ]
}

Be objective and base your assessment on visual evidence and error logs.`;
}

/**
 * Generate prompt for screenshot comparison (detecting changes)
 */
export function generateChangeDetectionPrompt(): string {
  return `Compare these two screenshots from a browser game taken a few seconds apart.

Determine if there are meaningful changes indicating the game is:
- Animating or updating
- Responding to user input
- Running actively (not frozen)

Look for:
- Position changes of game elements
- Visual effects or animations
- UI updates
- Score/timer changes
- Different game states

Respond with JSON:
{
  "has_changes": true/false,
  "change_type": "animation/input_response/state_change/none",
  "confidence": 0.0-1.0,
  "description": "what changed between the screenshots"
}`;
}

/**
 * Generate prompt for UI element detection
 */
export function generateUIDetectionPrompt(): string {
  return `Analyze this screenshot of a browser game and identify key UI elements.

Look for:
- Start/Play buttons
- Menu screens
- Game canvas or play area
- HUD elements (score, health, lives)
- Game over screens
- Loading indicators
- Error messages

Respond with JSON:
{
  "ui_elements": ["list of detected elements"],
  "game_state": "menu/loading/playing/game_over/error",
  "interactive_elements": ["clickable buttons or controls"],
  "confidence": 0.0-1.0
}`;
}

/**
 * Format logs for LLM context (truncate long messages)
 */
export function formatLogsForPrompt(logs: LogEntry[], maxLength: number = 100): string[] {
  return logs.map((log) => {
    const message = log.message.length > maxLength 
      ? log.message.substring(0, maxLength) + '...' 
      : log.message;
    return `[${log.level.toUpperCase()}] ${message}`;
  });
}

/**
 * Create structured system prompt for the QA agent
 */
export const QA_SYSTEM_PROMPT = `You are an expert QA engineer specializing in browser game testing.

Your role is to:
- Analyze screenshots and logs objectively
- Identify functional issues and bugs
- Assess playability and user experience
- Provide confidence scores for your evaluations
- Be specific in your observations

Always respond with valid JSON in the requested format.
Base your assessment on concrete evidence from screenshots and logs.
If uncertain, reflect that in your confidence score.`;

