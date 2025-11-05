/**
 * Example: Using Input Control Hints with QA Agent
 * 
 * This example demonstrates how to provide input control hints
 * to guide the QA agent's testing strategy.
 */

import { runQA } from '../src/index.js';

async function testWithSemanticHints() {
  console.log('Testing with semantic hints...\n');

  const report = await runQA('https://2048game.com', {
    inputHints: {
      type: 'semantic',
      content: 'Use arrow keys to move tiles in 4 directions. No jumping or shooting required.',
    },
  });

  console.log('Test completed:', report.status);
  console.log('Playability score:', report.playability_score);
}

async function testWithJavaScriptHints() {
  console.log('Testing with JavaScript hints...\n');

  const report = await runQA('https://example.com/my-game', {
    inputHints: {
      type: 'javascript',
      content: `
        gameBuilder.createAction('Jump')
          .bindKey(' ')
          .bindKey('w')
          .bindVirtualButton('#btn-jump');

        gameBuilder.createAxis2D('Move')
          .bindWASD()
          .bindArrowKeys()
          .bindJoystick('#joystick')
          .setSmoothing(0.2);
      `,
    },
  });

  console.log('Test completed:', report.status);
  console.log('Playability score:', report.playability_score);
}

async function testWithoutHints() {
  console.log('Testing without hints (auto-detection)...\n');

  const report = await runQA('https://example.com/unknown-game', {
    // No inputHints provided - will use auto-detection
  });

  console.log('Test completed:', report.status);
  console.log('Playability score:', report.playability_score);
}

// Run examples
async function main() {
  try {
    // Test with semantic hints (third-party game)
    await testWithSemanticHints();

    // Test with JavaScript hints (first-party DreamUp game)
    // await testWithJavaScriptHints();

    // Test without hints (falls back to auto-detection)
    // await testWithoutHints();
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

// Uncomment to run
// main();

