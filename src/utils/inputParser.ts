/**
 * Input hints parser for control scheme detection
 */

import { InputHints, ControlScheme } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Parse input hints to extract control scheme
 */
export function parseInputHints(hints: InputHints): ControlScheme | null {
  try {
    if (hints.type === 'javascript') {
      return parseJavaScriptHints(hints.content);
    } else if (hints.type === 'semantic') {
      return parseSemanticHints(hints.content);
    }
    return null;
  } catch (error) {
    logger.warn('Failed to parse input hints', { error: (error as Error).message });
    return null;
  }
}

/**
 * Parse JavaScript snippet format (first-party DreamUp games)
 * Extracts createAction(), createAxis(), createAxis2D() calls
 */
function parseJavaScriptHints(content: string): ControlScheme {
  const actions: ControlScheme['actions'] = [];
  const axes: ControlScheme['axes'] = [];

  // Parse Actions: gameBuilder.createAction('Jump').bindKey(' ').bindVirtualButton('#btn-jump')
  const actionRegex = /createAction\(['"](\w+)['"]\)([\s\S]*?)(?=\.createAction|\.createAxis|$)/g;
  let match;

  while ((match = actionRegex.exec(content)) !== null) {
    const actionName = match[1];
    const actionChain = match[2];

    const keys: string[] = [];
    const buttons: string[] = [];

    // Extract bindKey() calls
    const bindKeyRegex = /\.bindKey\(['"]([^'"]+)['"]\)/g;
    let keyMatch;
    while ((keyMatch = bindKeyRegex.exec(actionChain)) !== null) {
      keys.push(keyMatch[1]);
    }

    // Extract bindVirtualButton() calls
    const bindButtonRegex = /\.bindVirtualButton\(['"]([^'"]+)['"]\)/g;
    let buttonMatch;
    while ((buttonMatch = bindButtonRegex.exec(actionChain)) !== null) {
      buttons.push(buttonMatch[1]);
    }

    if (keys.length > 0 || buttons.length > 0) {
      actions.push({
        name: actionName,
        keys,
        buttons: buttons.length > 0 ? buttons : undefined,
      });
    }
  }

  // Parse 2D Axes: gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()
  const axis2DRegex = /createAxis2D\(['"](\w+)['"]\)([\s\S]*?)(?=\.createAction|\.createAxis|$)/g;
  while ((match = axis2DRegex.exec(content)) !== null) {
    const axisName = match[1];
    const axisChain = match[2];

    const keys: string[] = [];
    const bindings: string[] = [];

    // Check for bindWASD()
    if (axisChain.includes('.bindWASD()')) {
      keys.push('w', 'a', 's', 'd');
      bindings.push('WASD');
    }

    // Check for bindArrowKeys()
    if (axisChain.includes('.bindArrowKeys()')) {
      keys.push('ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight');
      bindings.push('Arrow Keys');
    }

    // Extract bindJoystick()
    const joystickRegex = /\.bindJoystick\(['"]([^'"]+)['"]\)/;
    const joystickMatch = axisChain.match(joystickRegex);
    if (joystickMatch) {
      bindings.push(`Joystick: ${joystickMatch[1]}`);
    }

    if (keys.length > 0 || bindings.length > 0) {
      axes.push({
        name: axisName,
        type: '2d',
        keys,
        bindings: bindings.length > 0 ? bindings : undefined,
      });
    }
  }

  // Parse 1D Axes: gameBuilder.createAxis('MoveHorizontal').bindKeys('a', 'd')
  const axis1DRegex = /createAxis\(['"](\w+)['"]\)([\s\S]*?)(?=\.createAction|\.createAxis|$)/g;
  while ((match = axis1DRegex.exec(content)) !== null) {
    const axisName = match[1];
    const axisChain = match[2];

    const keys: string[] = [];
    const bindings: string[] = [];

    // Extract bindKeys() calls
    const bindKeysRegex = /\.bindKeys\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g;
    let keysMatch;
    while ((keysMatch = bindKeysRegex.exec(axisChain)) !== null) {
      keys.push(keysMatch[1], keysMatch[2]);
    }

    // Extract bindButtons()
    const bindButtonsRegex = /\.bindButtons\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g;
    let buttonsMatch;
    while ((buttonsMatch = bindButtonsRegex.exec(axisChain)) !== null) {
      bindings.push(`Buttons: ${buttonsMatch[1]}, ${buttonsMatch[2]}`);
    }

    if (keys.length > 0 || bindings.length > 0) {
      axes.push({
        name: axisName,
        type: '1d',
        keys,
        bindings: bindings.length > 0 ? bindings : undefined,
      });
    }
  }

  logger.info('Parsed JavaScript input hints', {
    actionsCount: actions.length,
    axesCount: axes.length,
  });

  return {
    actions,
    axes,
    source: 'hints',
  };
}

/**
 * Parse semantic description format (third-party games)
 * Examples: "Use arrow keys for movement", "WASD to move, spacebar to jump"
 */
function parseSemanticHints(content: string): ControlScheme {
  const actions: ControlScheme['actions'] = [];
  const axes: ControlScheme['axes'] = [];

  const lowerContent = content.toLowerCase();

  // Detect common action keywords
  const actionPatterns = [
    { keyword: 'jump', keys: [' ', 'w', 'ArrowUp'] },
    { keyword: 'shoot', keys: ['x', 'z', ' '] },
    { keyword: 'fire', keys: ['x', 'z', ' '] },
    { keyword: 'attack', keys: ['x', 'z', ' '] },
    { keyword: 'interact', keys: ['e', 'Enter', ' '] },
    { keyword: 'action', keys: ['e', 'Enter', ' '] },
  ];

  for (const pattern of actionPatterns) {
    if (lowerContent.includes(pattern.keyword)) {
      // Check if specific key is mentioned
      const detectedKeys: string[] = [];

      if (lowerContent.includes('space') || lowerContent.includes('spacebar')) {
        detectedKeys.push(' ');
      }
      if (lowerContent.includes('enter')) {
        detectedKeys.push('Enter');
      }

      // If no specific key mentioned, use defaults
      actions.push({
        name: pattern.keyword.charAt(0).toUpperCase() + pattern.keyword.slice(1),
        keys: detectedKeys.length > 0 ? detectedKeys : pattern.keys,
      });
    }
  }

  // Detect movement controls
  const hasWASD = lowerContent.includes('wasd') || lowerContent.includes('w a s d');
  const hasArrows =
    lowerContent.includes('arrow') ||
    lowerContent.includes('arrow key') ||
    lowerContent.includes('directional');

  if (hasWASD || hasArrows || lowerContent.includes('move')) {
    const keys: string[] = [];
    const bindings: string[] = [];

    if (hasWASD) {
      keys.push('w', 'a', 's', 'd');
      bindings.push('WASD');
    }

    if (hasArrows) {
      keys.push('ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight');
      bindings.push('Arrow Keys');
    }

    // If neither WASD nor arrows mentioned explicitly, assume both
    if (!hasWASD && !hasArrows && lowerContent.includes('move')) {
      keys.push('w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight');
      bindings.push('WASD', 'Arrow Keys');
    }

    // Detect if 2D or 1D movement
    const is1D =
      lowerContent.includes('horizontal') ||
      lowerContent.includes('left') ||
      lowerContent.includes('right');
    const is2D =
      lowerContent.includes('4 direction') ||
      lowerContent.includes('four direction') ||
      lowerContent.includes('up') ||
      lowerContent.includes('down');

    if (keys.length > 0) {
      axes.push({
        name: 'Move',
        type: is1D && !is2D ? '1d' : '2d',
        keys,
        bindings: bindings.length > 0 ? bindings : undefined,
      });
    }
  }

  // Detect mouse controls
  if (lowerContent.includes('click') || lowerContent.includes('mouse')) {
    actions.push({
      name: 'Click',
      keys: [], // Mouse doesn't have keyboard keys
      buttons: ['mouse-left'],
    });
  }

  logger.info('Parsed semantic input hints', {
    actionsCount: actions.length,
    axesCount: axes.length,
    content: content.substring(0, 100),
  });

  return {
    actions,
    axes,
    source: 'hints',
  };
}

/**
 * Get prioritized list of keys to try based on control scheme
 */
export function getPrioritizedKeys(scheme: ControlScheme | null): string[] {
  if (!scheme) {
    return [];
  }

  const keys = new Set<string>();

  // Add action keys
  for (const action of scheme.actions) {
    for (const key of action.keys) {
      keys.add(key);
    }
  }

  // Add axis keys
  for (const axis of scheme.axes) {
    for (const key of axis.keys) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

/**
 * Get list of actions to attempt based on control scheme
 */
export function getPrioritizedActions(scheme: ControlScheme | null): string[] {
  if (!scheme) {
    return [];
  }

  return scheme.actions.map((a) => a.name);
}

/**
 * Check if control scheme indicates 2D movement
 */
export function has2DMovement(scheme: ControlScheme | null): boolean {
  if (!scheme) {
    return false;
  }

  return scheme.axes.some((axis) => axis.type === '2d');
}

/**
 * Check if control scheme indicates 1D movement
 */
export function has1DMovement(scheme: ControlScheme | null): boolean {
  if (!scheme) {
    return false;
  }

  return scheme.axes.some((axis) => axis.type === '1d');
}

