# DreamUp QA Agent

AI-powered autonomous testing agent for browser games. Built for DreamUp's game generation pipeline.

## Overview

DreamUp QA Agent autonomously tests browser games by simulating user interactions, capturing visual evidence, and evaluating playability using AI. It works with any web-hosted game URL and generates structured reports with actionable insights.

## Features

- 🤖 **Autonomous Testing**: Automatically detects UI patterns, simulates gameplay, and navigates through game screens
- 🎮 **Input Control Hints**: Accept control hints from game builders (JavaScript or semantic descriptions)
- ⚡ **Quick Test Mode**: Fast functional verification of input controls without LLM overhead
- 🎯 **LLM-Driven Testing**: Strategic gameplay with temporal context and pause-step synchronization
- 📸 **Evidence Capture**: Timestamped screenshots, animated GIFs, and console logs
- 🧠 **AI Evaluation**: Uses LLMs to assess playability, control responsiveness, and stability
- 📊 **Visual Dashboard**: Interactive web UI for viewing test reports and gameplay recordings
- 🚀 **Multiple Interfaces**: CLI, programmatic API, and Lambda-ready

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Browserbase account (free tier available)
- OpenAI, Anthropic, or Groq API key

### Installation

```bash
# Install dependencies
npm install

# or with bun
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
```

### Configuration

Edit `.env` file with your credentials:

```env
BROWSERBASE_API_KEY=your_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here
OPENAI_API_KEY=your_openai_key_here  # or ANTHROPIC_API_KEY
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
```

### Usage

#### CLI

```bash
# Build and link
npm run build && npm link

# Basic test
qa-agent https://your-game-url.com

# Quick test mode (fast input verification)
qa-agent https://your-game-url.com --quick-test

# LLM-driven with pause-step mode
qa-agent https://your-game-url.com --pause 0.5 --model gpt-4o --timeout 180000

# With input hints
qa-agent https://your-game-url.com \
  --hints "Use arrow keys to move" \
  --hints-type semantic

# With game-specific strategy
qa-agent https://your-game-url.com \
  --context "You control the right paddle. React early to ball movement." \
  --pause 0.25
```

**See [DEMO.md](DEMO.md) for complete demo walkthrough.**

#### Programmatic API

```typescript
import { runQA } from 'dreamup-qa-agent';

// Basic test
const report = await runQA('https://your-game-url.com', {
  maxExecutionTime: 300000,
  verbose: true,
});

// Quick test mode
const report = await runQA('https://your-game-url.com', {
  quickTest: true,
  inputHints: {
    type: 'semantic',
    content: 'Use arrow keys to move',
  },
});

// Full LLM-driven test
const report = await runQA('https://your-game-url.com', {
  model: 'gpt-4o',
  pauseInterval: 0.5,
  gameContext: 'You control the right paddle. React early.',
  inputHints: {
    type: 'javascript',
    content: 'gameBuilder.createAxis("Move").bindArrowKeys()',
  },
});
```

#### Dashboard Viewer

View test reports in a visual dashboard:

```bash
# Start the viewer
cd viewer && npm run dev

# Open http://localhost:5173
# Test reports auto-appear in the dashboard
```

The dashboard shows:
- 🎬 Animated GIFs of gameplay
- 📸 Screenshot timeline with temporal context
- 🏷️ Test configuration badges (model, pause, speed, timeout)
- 📊 Playability scores and LLM evaluations
- 🐛 Issues with severity levels

#### Lambda Integration

```typescript
import { runQA } from 'dreamup-qa-agent';

export const handler = async (event) => {
  const { gameUrl } = event;
  const report = await runQA(gameUrl);
  return {
    statusCode: 200,
    body: JSON.stringify(report),
  };
};
```

## Report Structure

```typescript
{
  status: 'pass' | 'fail' | 'error',
  playability_score: 0-100,
  confidence_score: 0-100,
  issues: [
    {
      severity: 'critical' | 'high' | 'medium' | 'low',
      description: string,
      category: 'load' | 'controls' | 'stability' | 'ui'
    }
  ],
  screenshots: ['path/to/screenshot1.png', ...],
  gif_path: 'path/to/gameplay.gif',
  logs: ['path/to/logs.json'],
  metadata: {
    game_url: string,
    timestamp: string,
    duration_ms: number,
    browser: string,
    viewport: { width: number, height: number },
    llm_model: string,
    test_config: {
      pause_interval?: number,
      game_speed?: number,
      timeout_ms?: number,
      has_input_hints?: boolean,
      has_game_context?: boolean,
      quick_test?: boolean
    }
  }
}
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## Testing

**📖 Full Testing Guide:** See [tests/TEST_GUIDE.md](tests/TEST_GUIDE.md) for:
- Setup instructions (npm link, ngrok)
- Testing with public games (2048, etc.)
- Testing local DreamUp games (Pong, Snake)
- Input hints usage & examples
- Automated test suite

**Quick test:**
```bash
# Build and link CLI
npm run build
npm link

# Test a public game
qa-agent https://gabrielecirulli.github.io/2048/ --hints "Use arrow keys to move tiles"

# Run automated test suite
./tests/run-tests.sh
```

## Development

```bash
# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Run tests
npm test
```

## Test Cases

The agent has been validated against:

1. Simple puzzle games (click interactions)
2. Platformers (keyboard controls)
3. Idle/clicker games (minimal interaction)
4. Broken games (error detection)
5. Complex multi-screen games (navigation)

## Test Modes

### Quick Test Mode
Fast functional verification by pressing all control keys randomly without LLM involvement. Perfect for:
- Smoke testing input bindings
- Validating controls work
- Rapid iteration during development

### LLM-Driven Mode
Strategic gameplay with AI decision-making. Features:
- **Temporal context**: Sends last 3 frames to understand direction/velocity
- **Pause-step mode**: Synchronizes LLM decisions with game progression
- **Game context**: Inject specific strategy instructions
- **Adaptive timeouts**: Graceful exits with partial data capture

## Limitations

- Best results with DreamUp games (pause control support)
- LLM latency requires pause mode for fast-paced games
- No multiplayer or network-dependent games
- No mobile browser emulation
- Configurable max execution time (default: 5 minutes)

## Documentation

- 📖 **[DEMO.md](DEMO.md)** - Complete demo walkthrough with examples
- 📚 **[tests/TEST_GUIDE.md](tests/TEST_GUIDE.md)** - Detailed testing guide
- 🏗️ **[docs/dreamup_prd.md](docs/dreamup_prd.md)** - Product requirements
- 📋 **[docs/dreamup_tasks.md](docs/dreamup_tasks.md)** - Implementation roadmap
- 🎮 **[examples/input-hints-example.ts](examples/input-hints-example.ts)** - Input hints examples

## Contributing

This is a prototype project. See [docs/dreamup_tasks.md](docs/dreamup_tasks.md) for implementation roadmap.

## License

MIT

## Contact

Questions? Contact [Matt Smith](mailto:matt.smith@superbuilders.school)

