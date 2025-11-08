# DreamUp QA Agent - Usage Guide

## Basic Command

```bash
qa-agent <game-url> [options]
```

or

```bash
node dist/cli.js <game-url> [options]
```

## All Available Flags

### Required Arguments
- `<game-url>` - URL of the browser game to test

### Options

#### General Options
- `-v, --verbose` - Enable verbose logging (shows detailed debug information)
- `-o, --output <dir>` - Output directory for test artifacts (default: `./output`)
- `-h, --help` - Show help message

#### LLM Configuration
- `-m, --model <name>` - LLM model to use
  - Options: `gpt-5`, `gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `gpt-4-turbo`, `gpt-4`
  - Default: `gpt-4o`
- `--reasoning-effort <level>` - Reasoning effort level for gpt-5 and o1 models
  - Options: `low`, `medium`, `high`
  - Default: `medium`
  - Example: `--model gpt-5 --reasoning-effort high`

#### Input Control Hints
- `--hints <text>` or `--input-hints <text>` - Input control hints (semantic description or JavaScript snippet)
  - Semantic example: `"Use arrow keys to move tiles"`
  - JavaScript example: `"createAction('Jump').bindKey(' ')"`
- `--hints-type <type>` - Hints format type
  - Options: `semantic`, `javascript`
  - Default: `semantic`

#### Game Context
- `--context <text>` - Game-specific context for the AI (paddle position, objectives, etc.)
  - Example: `"You control the RIGHT paddle. Move to intercept the ball."`
  - Example: `"Snake game: Use arrow keys to control the snake. Move towards the orange food to grow."`

#### Execution Modes
**Default Behavior:** If no flags are provided for `--speed`, `--pause`, or `--quick-test`, the game will run in **regular LLM mode** by default. In this mode, the LLM makes continuous decisions without pausing the game, and the game runs at normal speed.

- `--pause <seconds>` - Pause-step mode: pause game every X seconds for LLM decision
  - Examples: `0.5` (pause every 500ms), `1.0` (every 1s), `0.35` (every 350ms)
  - Only works with DreamUp games (games that support pause mode)
  - Cannot be used with `--speed` or `--quick-test`
- `--speed <number>` - Game speed multiplier
  - Examples: `0.1` (10% speed), `0.5` (50%), `2.0` (200%)
  - Default: `1.0`
  - Cannot be used with `--pause` or `--quick-test`
- `--quick-test` - Fast functional test mode - press all hint keys without LLM
  - Default timeout: 30s
  - Cannot be used with `--pause`, `--speed`, or `--model`

#### Performance Metrics
- `--collect-performance` - Capture navigation timing, FPS samples, interaction latency, long-task blocking time, slow resources, console error count, and heap usage
  - Disabled by default to minimize overhead and Browserbase session work
  - Equivalent environment flag: `COLLECT_PERFORMANCE_METRICS=true`

#### Timeout
- `-t, --timeout <ms>` - Test execution timeout in milliseconds
  - Default: `300000` (5 minutes)
  - Examples: `60000` (1 min), `120000` (2 min), `480000` (8 min), `600000` (10 min)

## Example Commands

### Example 1: Snake Game with Pause Mode

```bash
node dist/cli.js \
  --url "https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/snake/" \
  --pause 0.35 \
  --timeout 480000 \
  --context "Snake game: Use arrow keys to control the snake. Move towards the orange food to grow. Avoid hitting walls or your own tail. The goal is to get the snake as long as possible by going over the orange food squares as they appear. Arrow direction needs to be determined from user perspective not from the snakes perspective. The head of the snake is lighter in shade compared to the rest of the body." \
  --model gpt-5 \
  --reasoning-effort low
```

**What this does:**
- Tests the snake game with pause-step synchronization (pauses every 350ms for LLM decision)
- Uses `gpt-5` model with `low` reasoning effort for faster responses
- Runs for 8 minutes (480 seconds) before timeout
- Provides game-specific context to guide the LLM's gameplay strategy
- No input hints needed (game auto-detects arrow keys)

### Example 2: Pong Game with Input Hints

```bash
node dist/cli.js \
  --url "https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/pong/" \
  --pause 0.35 \
  --timeout 480000 \
  --context "Pong game: You control the right paddle. Use ArrowUp to move the paddle up and ArrowDown to move the paddle down. The goal is to hit the ball back to the left side and prevent it from getting past your paddle. Keep the ball in play by moving the paddle to intercept the ball's trajectory." \
  --hints "Use ArrowUp to move paddle up and ArrowDown to move paddle down" \
  --model gpt-5 \
  --reasoning-effort low
```

**What this does:**
- Tests the pong game with pause-step synchronization (pauses every 350ms)
- Uses `gpt-5` model with `low` reasoning effort
- Runs for 8 minutes (480 seconds) before timeout
- Provides game context explaining paddle control and objectives
- **Includes input hints** to restrict LLM to only use `ArrowUp` and `ArrowDown` keys
- The evaluation will only give full controls score if both hint keys are tested

### Example 3: 2048 Game in Regular LLM Mode

```bash
node dist/cli.js \
  --url "https://gabrielecirulli.github.io/2048/" \
  --hints "Use arrow keys to move tiles" \
  --timeout 300000
```

**What this does:**
- Tests the 2048 game in **regular LLM mode** (no pause, no speed adjustment)
- LLM makes continuous decisions without pausing the game
- Game runs at normal speed
- Uses input hints to restrict LLM to arrow keys only
- Runs for 5 minutes (default timeout) before timeout
- No pause mode flag = regular LLM mode with continuous gameplay

### Example 4: Pong with Performance Telemetry

```bash
qa-agent https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/pong/ \
  --pause 0.35 \
  --timeout 480000 \
  --context "Pong game: You control the right paddle. Use ArrowUp to move the paddle up and ArrowDown to move the paddle down." \
  --hints "Use ArrowUp to move paddle up and ArrowDown to move paddle down" \
  --collect-performance
```

**What this does:**
- Runs the DreamUp Pong example with pause-step synchronization and input hints
- Enables performance telemetry (load timing, FPS, interaction latency, long tasks, slow resources, memory)
- Surfaced in the dashboard inside the “Performance Metrics” panel and stored in `qa-report.json.performance`

## Understanding the Results

### Status
- ✅ **PASS** - Score ≥ 60 and no critical issues
- ⚠️ **FAIL** - Score 30-59
- ❌ **ERROR** - Score < 30 OR any critical issues

### Playability Score (0-100)
- **80-100**: Excellent playability
- **60-79**: Good playability with minor issues
- **40-59**: Playable but with significant issues
- **20-39**: Barely playable, major problems
- **0-19**: Not playable

### Score Breakdown
- **Load Success** (30%): Game loaded successfully
- **Controls** (30%): Controls are responsive (requires all hint keys tested if hints provided)
- **Stability** (30%): Game runs without crashes/freezes
- **UI Visibility** (10%): Game UI elements are visible

### Penalties
- **Critical issues**: -30 each
- **High issues**: -15 each
- **Medium issues**: -7 each
- **Low issues**: -3 each

## Output

After running a test, you'll find:
- **Report**: `output/<session-dir>/qa-report.json` - Complete test report with scores, issues, metadata
- **Performance metrics**: When `--collect-performance` (or env flag) is enabled, the report includes a `performance` block with navigation timing, FPS, latency, long tasks, slow resources, console errors, and memory snapshot data
- **Screenshots**: `output/<session-dir>/screenshots/` - All captured screenshots with LLM metadata
- **GIF**: `output/<session-dir>/*.gif` - Animated gameplay visualization
- **Logs**: `output/<session-dir>/logs/console-logs.json` - Browser console logs

View reports in the web dashboard:
```bash
cd viewer && npm start
```
Then open `http://localhost:3000` in your browser.

