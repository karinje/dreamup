# DreamUp QA Agent

AI-powered autonomous testing agent for browser games. Built for DreamUp's game generation pipeline.

## Overview

DreamUp QA Agent autonomously tests browser games by simulating user interactions, capturing visual evidence, and evaluating playability using AI. It works with any web-hosted game URL and generates structured reports with actionable insights.

## Features

- 🤖 **Autonomous Testing**: Automatically detects UI patterns, simulates gameplay, and navigates through game screens
- 📸 **Evidence Capture**: Takes timestamped screenshots and collects console logs
- 🧠 **AI Evaluation**: Uses LLMs to assess playability, control responsiveness, and stability
- 📊 **Structured Reports**: Generates JSON reports with scores, issues, and confidence metrics
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
# Run a test
npm run dev -- https://your-game-url.com

# After building
npm run build
qa-agent https://your-game-url.com
```

#### Programmatic API

```typescript
import { runQA } from 'dreamup-qa-agent';

const report = await runQA('https://your-game-url.com', {
  maxExecutionTime: 300000, // 5 minutes
  screenshotCount: 5,
  verbose: true,
});

console.log(report);
```

#### Using Input Control Hints (NEW)

Provide hints about game controls to guide testing:

```typescript
// Semantic hints (third-party games)
const report = await runQA('https://2048game.com', {
  inputHints: {
    type: 'semantic',
    content: 'Use arrow keys to move tiles in 4 directions',
  },
});

// JavaScript hints (DreamUp-generated games)
const report = await runQA('https://my-game.com', {
  inputHints: {
    type: 'javascript',
    content: `
      gameBuilder.createAction('Jump').bindKey(' ');
      gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys();
    `,
  },
});
```

CLI usage:
```bash
qa-agent https://2048game.com --hints "Use arrow keys to move tiles"
qa-agent https://game.com --hints "createAction('Jump').bindKey(' ')" --hints-type javascript
```

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
  logs: ['path/to/logs.json'],
  metadata: {
    game_url: string,
    timestamp: string,
    duration_ms: number,
    browser: string,
    viewport: { width: number, height: number }
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

## Limitations

- No multiplayer or network-dependent games
- No mobile browser emulation
- No security/performance testing
- 5-minute max execution time per game

## Contributing

This is a prototype project. See [docs/dreamup_tasks.md](docs/dreamup_tasks.md) for implementation roadmap.

## License

MIT

## Contact

Questions? Contact [Matt Smith](mailto:matt.smith@superbuilders.school)

