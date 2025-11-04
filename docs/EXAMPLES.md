# Usage Examples

## Command Line Interface

### Basic Usage

```bash
qa-agent https://example.com/game
```

### With Options

```bash
# Verbose output
qa-agent https://example.com/game --verbose

# Custom output directory
qa-agent https://example.com/game --output ./test-results

# Help
qa-agent --help
```

## Programmatic API

### Simple Test

```typescript
import { runQA } from 'dreamup-qa-agent';

async function testGame() {
  const report = await runQA('https://example.com/game');

  console.log(`Status: ${report.status}`);
  console.log(`Score: ${report.playability_score}/100`);
  console.log(`Issues: ${report.issues.length}`);
}

testGame();
```

### With Custom Options

```typescript
import { runQA, QAOptions } from 'dreamup-qa-agent';

const options: QAOptions = {
  maxExecutionTime: 180000, // 3 minutes
  screenshotCount: 7,
  verbose: true,
  outputDir: './test-results',
};

const report = await runQA('https://example.com/game', options);
```

### Batch Testing

```typescript
import { runQA } from 'dreamup-qa-agent';

const games = [
  'https://example.com/game1',
  'https://example.com/game2',
  'https://example.com/game3',
];

async function testMultipleGames() {
  const results = [];

  for (const gameUrl of games) {
    try {
      console.log(`Testing: ${gameUrl}`);
      const report = await runQA(gameUrl);
      results.push({ url: gameUrl, report });

      // Cooldown between tests
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`Failed to test ${gameUrl}:`, error);
      results.push({ url: gameUrl, error: error.message });
    }
  }

  return results;
}

testMultipleGames().then((results) => {
  console.log('All tests complete:', results);
});
```

### CI/CD Integration

```typescript
import { runQA } from 'dreamup-qa-agent';

async function ciTest() {
  const gameUrl = process.env.GAME_URL;

  if (!gameUrl) {
    throw new Error('GAME_URL environment variable required');
  }

  const report = await runQA(gameUrl, {
    outputDir: './ci-artifacts',
  });

  // Fail CI if game is not playable
  if (report.status === 'error' || report.playability_score < 50) {
    console.error('Game failed QA test');
    process.exit(1);
  }

  console.log('Game passed QA test');
  process.exit(0);
}

ciTest();
```

### AWS Lambda Handler

```typescript
// handler.ts
import { runQA } from 'dreamup-qa-agent';

export async function handler(event) {
  const { gameUrl, maxExecutionTime } = event;

  if (!gameUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'gameUrl is required' }),
    };
  }

  try {
    const report = await runQA(gameUrl, {
      maxExecutionTime: maxExecutionTime || 180000,
      verbose: false,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Test failed',
        message: error.message,
      }),
    };
  }
}
```

### Express.js API Endpoint

```typescript
import express from 'express';
import { runQA } from 'dreamup-qa-agent';

const app = express();
app.use(express.json());

app.post('/test-game', async (req, res) => {
  const { gameUrl } = req.body;

  if (!gameUrl) {
    return res.status(400).json({ error: 'gameUrl is required' });
  }

  try {
    const report = await runQA(gameUrl);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log('QA API running on port 3000');
});
```

### Custom Report Processing

```typescript
import { runQA, QAReport } from 'dreamup-qa-agent';

async function testAndAnalyze(gameUrl: string) {
  const report = await runQA(gameUrl);

  // Custom analysis
  const criticalIssues = report.issues.filter((i) => i.severity === 'critical');

  const analysis = {
    url: gameUrl,
    passed: report.status === 'pass',
    score: report.playability_score,
    criticalIssues: criticalIssues.length,
    totalScreenshots: report.screenshots.length,
    testDuration: report.metadata.duration_ms,
    summary: generateSummary(report),
  };

  // Send to your analytics system
  await sendToAnalytics(analysis);

  return analysis;
}

function generateSummary(report: QAReport): string {
  if (report.status === 'pass') {
    return 'Game is fully playable';
  } else if (report.status === 'fail') {
    return `Game has ${report.issues.length} issues`;
  } else {
    return 'Game failed to load or crashed';
  }
}
```

## Testing Local Games

```typescript
import { runQA } from 'dreamup-qa-agent';
import express from 'express';

// Serve local game
const app = express();
app.use(express.static('./my-game'));
const server = app.listen(8080);

// Test it
try {
  const report = await runQA('http://localhost:8080');
  console.log(report);
} finally {
  server.close();
}
```

## Output Examples

### Successful Test

```json
{
  "status": "pass",
  "playability_score": 85,
  "confidence_score": 90,
  "issues": [
    {
      "severity": "low",
      "description": "Minor UI alignment issue",
      "category": "ui",
      "timestamp": "2025-11-04T10:30:00.000Z"
    }
  ],
  "screenshots": [
    "output/game_2025-11-04/screenshots/loading_001.png",
    "output/game_2025-11-04/screenshots/gameplay_002.png"
  ],
  "logs": ["output/game_2025-11-04/logs/console-logs.json"],
  "metadata": {
    "game_url": "https://example.com/game",
    "timestamp": "2025-11-04T10:29:30.000Z",
    "duration_ms": 45000,
    "browser": "Chromium (via Browserbase)",
    "viewport": { "width": 1280, "height": 720 },
    "llm_provider": "openai",
    "llm_model": "gpt-4o"
  }
}
```

### Failed Test

```json
{
  "status": "fail",
  "playability_score": 35,
  "confidence_score": 75,
  "issues": [
    {
      "severity": "high",
      "description": "Controls not responsive to keyboard input",
      "category": "controls",
      "timestamp": "2025-11-04T10:30:00.000Z"
    },
    {
      "severity": "medium",
      "description": "Game UI partially obscured",
      "category": "ui",
      "timestamp": "2025-11-04T10:30:15.000Z"
    }
  ],
  "screenshots": ["..."],
  "logs": ["..."],
  "metadata": {
    "..."
  }
}
```

