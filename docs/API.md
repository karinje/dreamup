# API Documentation

## Programmatic API

The DreamUp QA Agent can be imported and used programmatically in your Node.js applications.

### Installation

```bash
npm install dreamup-qa-agent
```

### Basic Usage

```typescript
import { runQA } from 'dreamup-qa-agent';

const report = await runQA('https://example.com/game');
console.log(report);
```

### API Reference

#### `runQA(gameUrl, options?)`

Runs a QA test on a browser game.

**Parameters:**

- `gameUrl` (string, required): The URL of the game to test
- `options` (QAOptions, optional): Configuration options

**Returns:** `Promise<QAReport>`

**Example:**

```typescript
const report = await runQA('https://example.com/game', {
  maxExecutionTime: 180000, // 3 minutes
  screenshotCount: 5,
  verbose: true,
  outputDir: './my-test-results',
});
```

### Types

#### `QAOptions`

```typescript
interface QAOptions {
  maxExecutionTime?: number; // Max test duration in ms (default: 300000)
  maxActionCount?: number; // Max game actions (default: 100)
  screenshotCount?: number; // Number of screenshots to capture (default: 5)
  verbose?: boolean; // Enable debug logging (default: false)
  outputDir?: string; // Output directory (default: './output')
}
```

#### `QAReport`

```typescript
interface QAReport {
  status: 'pass' | 'fail' | 'error';
  playability_score: number; // 0-100
  confidence_score: number; // 0-100
  issues: Issue[];
  screenshots: string[]; // File paths
  logs: string[]; // File paths
  metadata: TestMetadata;
  gif?: string; // Optional GIF recording path
}
```

#### `Issue`

```typescript
interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  category: 'load' | 'controls' | 'stability' | 'ui' | 'other';
  timestamp: string;
  screenshot?: string;
}
```

#### `TestMetadata`

```typescript
interface TestMetadata {
  game_url: string;
  timestamp: string;
  duration_ms: number;
  browser: string;
  viewport: {
    width: number;
    height: number;
  };
  llm_provider: string;
  llm_model: string;
}
```

### Lambda Integration

Use the provided Lambda handler for AWS Lambda deployment:

```typescript
import { createLambdaHandler } from 'dreamup-qa-agent';

export const handler = await createLambdaHandler();
```

Or create a custom handler:

```typescript
import { runQA } from 'dreamup-qa-agent';

export async function handler(event) {
  const { gameUrl } = event;

  try {
    const report = await runQA(gameUrl);
    return {
      statusCode: 200,
      body: JSON.stringify(report),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
```

### Error Handling

The API throws errors for configuration and execution problems:

```typescript
try {
  const report = await runQA(gameUrl);
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
  } else if (error instanceof BrowserError) {
    console.error('Browser error:', error.message);
  } else {
    console.error('Test failed:', error.message);
  }
}
```

### Environment Variables

Required environment variables:

```bash
# Browser automation
BROWSERBASE_API_KEY=your_key
BROWSERBASE_PROJECT_ID=your_project_id

# LLM provider (choose one)
OPENAI_API_KEY=your_key
# or
ANTHROPIC_API_KEY=your_key

# Configuration
LLM_PROVIDER=openai  # or 'anthropic'
LLM_MODEL=gpt-4o
```

See `.env.example` for complete configuration options.

