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
 * Generate prompt for detecting and handling modals/overlays
 */
export function generateModalDetectionPrompt(): string {
  return `Analyze this screenshot and determine if there are any modals, popups, or overlays blocking the main game interface.

**IMPORTANT**: Our goal is to PLAY the actual game, NOT do tutorials or learn how to play.

Look for:
- Welcome screens or tutorial prompts → SKIP or CLOSE them
- Cookie consent banners → Accept or close
- Age verification dialogs → Accept
- "How to play" instructions → SKIP
- Tutorial offers (e.g., "Would you like to learn?") → DECLINE or CLOSE
- Any overlay that needs to be dismissed
- Close buttons (X), Skip buttons, "No Thanks", or "Play Now" options

Respond with a JSON object:
{
  "has_modal": true/false,
  "modal_type": "welcome/tutorial/cookie/age_gate/other/none",
  "recommended_action": "Describe exactly what button/element to click to dismiss or proceed. Examples: 'Click the X button in top right', 'Click Skip Tutorial', 'Click No Thanks', 'Click the close button'",
  "confidence": 0.0-1.0
}

**Priority**: If you see both "Play Tutorial" and a close/skip option, ALWAYS choose to close/skip the tutorial!

If there's no modal, set has_modal to false and recommended_action to "none".`;
}

/**
 * Generate prompt for finding the game start mechanism
 */
export function generateGameStartPrompt(actionHistory: string[]): string {
  return `Analyze this screenshot and determine how to start or begin playing this game.

**IMPORTANT**: We want to play the ACTUAL game, NOT a tutorial. If you see tutorial options, avoid them!

Previous attempts:
${actionHistory.slice(-3).map((action, i) => `${i + 1}. ${action}`).join('\n') || 'None yet'}

Look for:
- "Play", "Start", "New Game", "Begin" buttons
- Game canvas that's already interactive (auto-start games)
- Menu options to start gameplay
- **AVOID**: "Play Tutorial", "Learn to Play", "How to Play" buttons

**Priority**:
1. If you see "New Game" → Click it
2. If you see a game board/canvas with tiles/pieces → The game is already started
3. If you see "Start" or "Play" (but NOT "Play Tutorial") → Click it
4. If you're in a tutorial screen → Return "Click Skip Tutorial" or "Click Exit Tutorial"

Respond with a JSON object:
{
  "game_state": "needs_start_button/already_started/in_tutorial/in_menu/unknown",
  "start_mechanism": "Describe exactly what to click or do to start. Examples: 'Click the New Game button', 'Click Start', 'Game is already playing', 'Skip the tutorial by clicking X'",
  "confidence": 0.0-1.0
}

Be specific about button text, colors, or positions. If multiple options exist, choose the one that gets us to actual gameplay fastest.`;
}

/**
 * Generate prompt for initial page analysis and navigation
 */
export function generateInitialNavigationPrompt(
  gameUrl: string
): string {
  return `You are an AI QA agent testing a browser game. Analyze this screenshot of the initial page load.

Game URL: ${gameUrl}

Your goal: Get to the actual playable game as quickly as possible.

Analyze the screenshot and determine:
1. Is there a modal/overlay blocking the game? (welcome screen, cookie notice, tutorial prompt, etc.)
2. What buttons or elements should be clicked to START playing?
3. Are there any obstacles preventing gameplay? (ads, popups, age gates, etc.)

Respond with a JSON object:
{
  "has_blocking_modal": true/false,
  "modal_description": "description of what's blocking",
  "recommended_action": "close_modal/click_start/click_new_game/dismiss_tutorial/skip_intro/click_play",
  "action_target": "specific button text or description to click",
  "reasoning": "why this action will get us to gameplay",
  "confidence": 0.0-1.0
}

Examples:
- If you see "Welcome! Would you like a tutorial?" → close_modal, target: "X button" or "Skip"
- If you see "Click to Start" → click_start, target: "Start button"
- If game is already visible with no overlays → "none", confidence: 1.0

Be direct and actionable. We want to PLAY the game, not do tutorials.`;
}

/**
 * Generate prompt for LLM-driven gameplay action selection
 */
export function generateGameplayActionPrompt(
  gameUrl: string,
  actionHistory: string[],
  currentPhase: string
): string {
  return `You are an AI playing a browser game. Analyze the current screenshot and decide what action to take next.

Game URL: ${gameUrl}
Current Phase: ${currentPhase}

Recent Actions Taken:
${actionHistory.slice(-5).map((action, i) => `${i + 1}. ${action}`).join('\n')}

Based on the screenshot, determine:
1. What type of game is this? (puzzle, platformer, clicker, arcade, etc.)
2. What controls does it likely use? (arrow keys, WASD, mouse clicks, spacebar, etc.)
3. What should you do next to progress in the game?

Respond with a JSON object:
{
  "game_type": "type of game detected",
  "recommended_controls": ["list", "of", "control", "types"],
  "next_action": "keyboard_arrows/keyboard_wasd/mouse_click/spacebar/combination",
  "action_description": "brief explanation of what to do",
  "confidence": 0.0-1.0
}

Be specific and practical. Choose actions that will actually progress the game.`;
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

