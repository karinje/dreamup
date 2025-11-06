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
  phases: GamePhase[],
  controlScheme?: any
): string {
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warningCount = logs.filter((l) => l.level === 'warn').length;

  // Extract hint keys if control scheme provided
  let hintKeysSection = '';
  let testedKeysSection = '';
  if (controlScheme && controlScheme.source === 'hints') {
    const hintKeys: string[] = [];
    if (controlScheme.actions) {
      controlScheme.actions.forEach((action: any) => {
        hintKeys.push(...action.keys);
      });
    }
    if (controlScheme.axes) {
      controlScheme.axes.forEach((axis: any) => {
        hintKeys.push(...axis.keys);
      });
    }
    const uniqueHintKeys = Array.from(new Set(hintKeys));
    
    if (uniqueHintKeys.length > 0) {
      hintKeysSection = `\n⚠️ INPUT HINTS PROVIDED - Required Keys to Test:\n${uniqueHintKeys.map(k => `- ${k}`).join('\n')}\n`;
      
      // Check which hint keys were actually tested in actionHistory
      const actionHistoryText = actionHistory.join(' ').toLowerCase();
      const testedKeys: string[] = [];
      const untestedKeys: string[] = [];
      
      uniqueHintKeys.forEach(key => {
        // Check if key appears in action history (case-insensitive)
        const keyVariations = [
          key.toLowerCase(),
          key.replace('Arrow', '').toLowerCase(), // "ArrowUp" -> "up"
          key.replace('Arrow', 'Arrow ').toLowerCase(), // "ArrowUp" -> "arrow up"
        ];
        const wasTested = keyVariations.some(variation => 
          actionHistoryText.includes(variation)
        );
        
        if (wasTested) {
          testedKeys.push(key);
        } else {
          untestedKeys.push(key);
        }
      });
      
      testedKeysSection = `\n📊 HINT KEY TESTING STATUS:\n`;
      if (testedKeys.length > 0) {
        testedKeysSection += `✅ Tested: ${testedKeys.join(', ')}\n`;
      }
      if (untestedKeys.length > 0) {
        testedKeysSection += `❌ NOT TESTED: ${untestedKeys.join(', ')}\n`;
      }
      testedKeysSection += `\n⚠️ CRITICAL: For controls_responsive to be true, ALL hint keys must be tested AND controls must respond. If any hint keys were not tested, set controls_responsive to false.\n`;
    }
  }

  return `You are a QA expert evaluating the overall playability of a browser game.

Game URL: ${gameUrl}
Test Duration: ${(duration / 1000).toFixed(1)}s
Actions Performed: ${actionHistory.length}
Console Errors: ${errorCount}
Console Warnings: ${warningCount}
Game Phases: ${phases.join(' → ')}
${hintKeysSection}${testedKeysSection}
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
3. Do controls respond to user input?${controlScheme && controlScheme.source === 'hints' ? ' (REQUIRED: All hint keys must be tested AND controls must respond)' : ''}
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
  currentPhase: string,
  controlScheme?: any,
  hasTemporalContext?: boolean,
  gameContext?: string
): string {
  // Build game-specific context section if provided
  let gameContextSection = '';
  if (gameContext) {
    gameContextSection = `
⚠️ GAME-SPECIFIC INSTRUCTIONS (CRITICAL):
${gameContext}

`;
  }

  // Build control scheme section if provided
  let controlsSection = '';
  if (controlScheme && controlScheme.source === 'hints') {
    controlsSection = '\n## THIS GAME\'S CONTROLS (from input hints):\n\n';
    
    if (controlScheme.actions && controlScheme.actions.length > 0) {
      controlsSection += '**Actions:**\n';
      controlScheme.actions.forEach((action: any) => {
        controlsSection += `- ${action.name}: ${action.keys.join(', ')}`;
        if (action.buttons && action.buttons.length > 0) {
          controlsSection += ` (or buttons: ${action.buttons.join(', ')})`;
        }
        controlsSection += '\n';
      });
      controlsSection += '\n';
    }
    
    if (controlScheme.axes && controlScheme.axes.length > 0) {
      controlsSection += '**Axes (movement):**\n';
      controlScheme.axes.forEach((axis: any) => {
        controlsSection += `- ${axis.name} (${axis.type}D): ${axis.keys.join(', ')}\n`;
      });
      controlsSection += '\n';
    }
    
    controlsSection += '**IMPORTANT: ONLY use the keys listed above! Other keys will not work in this game.**\n';
  } else {
    controlsSection = `
Key names you can use:
- Arrow keys: "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
- WASD: "w", "a", "s", "d"
- Special: "Space", "Enter", "Escape"
- Letters: "a"-"z" (lowercase)
`;
  }

  const temporalContextSection = hasTemporalContext ? `
## TEMPORAL CONTEXT (VERY IMPORTANT!):
You are seeing multiple frames labeled T-2, T-1, and T (current):
- **T-2** = Oldest frame (2 turns ago)
- **T-1** = Previous frame (1 turn ago) 
- **T** = Current frame (now)

**By comparing these frames, you MUST determine:**
1. Which direction is the player/character CURRENTLY moving?
2. What is the player's velocity/trajectory?
3. Where will the player be in the NEXT frame if you don't change direction?

**CRITICAL:** If you see the player getting closer to a wall/obstacle across frames, you MUST turn away IMMEDIATELY!
Look at the player's position changing across T-2 → T-1 → T to understand movement direction.

` : `
## SINGLE FRAME:
You are seeing a single screenshot. Since you don't have temporal context, be conservative with your decisions.
`;

  return `You are an AI playing a browser game. Analyze the screenshot(s) and decide EXACTLY what keys to press next.

Game URL: ${gameUrl}
Current Phase: ${currentPhase}

Recent Actions Taken:
${actionHistory.slice(-5).map((action, i) => `${i + 1}. ${action}`).join('\n') || 'None yet'}
${gameContextSection}${temporalContextSection}
${controlsSection}
Based on the screenshot(s), determine:
1. What type of game is this?
2. What is the current game state? (player position, obstacles, goals, dangers, etc.)
3. What SPECIFIC keys should be pressed next to achieve the game's objective?
4. What should you AVOID? (walls, enemies, hazards, death, game over, etc.)

CRITICAL STRATEGY RULES:
- Identify the game's WIN condition (collect items, reach goal, survive, etc.)
- Identify DEATH/FAIL conditions (walls, enemies, falling, time up, etc.)
- Plan ahead - don't just move toward immediate goals, avoid traps!
- If approaching danger (wall, edge, enemy), change direction BEFORE it's too late!

Respond with a JSON object:
{
  "game_type": "type of game detected",
  "game_state": "brief description: player position, goals visible, dangers nearby",
  "keys_to_press": ["ArrowUp"],
  "reasoning": "why these keys achieve the objective while avoiding death/failure",
  "confidence": 0.0-1.0
}

Return 1-3 keys maximum (usually just 1). Be strategic - survival first, then objectives!`;
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

