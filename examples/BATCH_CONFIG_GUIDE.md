# Batch Testing - Per-Game Flags Example

This example demonstrates how to use **per-game flags** with **global defaults**.

## How It Works

- **Per-game flags** take priority (if specified in game object)
- **Global flags** become defaults (used when not specified per-game)
- **Global arrays** generate combinations (for games without per-game overrides)

## Example Config

```json
{
  "games": [
    {
      "url": "https://game1.com",
      "name": "Snake Game",
      "pauseInterval": 0.35,
      "timeout": 480000,
      "model": "gpt-4o",
      "quickTest": false,
      "collectPerformanceMetrics": true,
      "inputHints": { "type": "semantic", "content": "..." },
      "gameContext": "..."
    },
    {
      "url": "https://game2.com",
      "name": "Pong Game",
      "pauseInterval": 0.5,
      "model": "gpt-4o-mini",
      "quickTest": false,
      "collectPerformanceMetrics": false
    },
    {
      "url": "https://game3.com",
      "name": "2048 Game",
      "quickTest": true
    },
    "https://game4.com"
  ],
  "models": ["gpt-4o", "gpt-4o-mini"],
  "pauseInterval": [0.35, 0.5],
  "timeout": [300000],
  "maxParallel": 5,
  "cooldownMs": 1000,
  "collectPerformanceMetrics": true
}
```

## Result

- **Snake Game**: Uses its own settings (pause 0.35, timeout 480000, gpt-4o) = **1 test**
- **Pong Game**: Uses its own pause/model and disables performance metrics locally, but timeout from global = **1 test**
- **2048 Game**: Uses its own quickTest, but models/pause/timeout from global = **2 models × 2 pause × 1 timeout = 4 tests**
- **game4.com**: Uses all global defaults = **2 models × 2 pause × 1 timeout = 4 tests**

**Total: 1 + 1 + 4 + 4 = 10 tests**

## Per-Game Flags Available

Each game object can specify:
- `model` - LLM model (string)
- `pauseInterval` - Pause interval in seconds (number)
- `gameSpeed` - Game speed multiplier (number)
- `quickTest` - Quick test mode (boolean)
- `timeout` - Test timeout in ms (number)
- `maxActionCount` - Max actions (number)
- `reasoningEffort` - Reasoning effort level ("low" | "medium" | "high")
- `inputHints` - Input control hints (object)
- `gameContext` - Game-specific context (string)
- `collectPerformanceMetrics` - Override global telemetry flag for the specific game (boolean)

## Global Flags (Defaults)

These apply to all games unless overridden:
- `models` - Array of models to test
- `pauseInterval` - Array of pause intervals
- `gameSpeed` - Array of game speeds
- `timeout` - Array of timeouts
- `quickTest` - Single boolean (or omit for both true/false)
- `inputHints` - Array of hints
- `gameContext` - Array of contexts
- `reasoningEffort` - Array of reasoning efforts
- `maxActionCount` - Array of max action counts
- `collectPerformanceMetrics` - Boolean default for whether telemetry is captured

## Common Flags (Always Global)

These are always global (not per-game):
- `maxParallel` - Max parallel browsers
- `cooldownMs` - Cooldown between batches
- `verbose` - Verbose logging
- `outputDir` - Output directory
- `continueOnError` - Continue on error

