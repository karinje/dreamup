# DreamUp QA Agent - Testing Guide

Complete guide for testing the QA agent with input hints.

## Prerequisites Setup (One-Time)

### 1. Build and Link the CLI

```bash
# From project root
npm run build
npm link
```

This makes `qa-agent` available globally in your terminal.

**Verify it works:**
```bash
qa-agent --help
```

### 2. Setup ngrok (for local games)

ngrok exposes your local server to the internet so Browserbase can access it.

**Sign up and configure:**
1. Sign up: https://dashboard.ngrok.com/signup
2. Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

**Important:** Your computer must stay running while testing local games!

## CLI Options Reference

### Model Selection (`--model`, `-m`)

Choose which LLM model to use for gameplay decisions:

**Available Models:**
- `gpt-4o` (default) - Best quality, slower, more expensive
- `gpt-4o-mini` - Faster, cheaper, good quality
- `o1` - Advanced reasoning model
- `o1-mini` - Faster reasoning model
- `gpt-4-turbo` - Previous gen flagship
- `gpt-4` - Classic GPT-4

**Example:**
```bash
qa-agent https://game.com --model gpt-4o-mini
```

### Game Speed Control (`--speed`)

Slow down games to give the AI more time to react. The LLM takes ~2-4 seconds per decision, so slower games work better.

**Format:** `--speed <number>` where:
- `1.0` = Normal speed (default)
- `0.5` = Half speed (50%)
- `0.2` = 20% speed (recommended for fast-paced games)
- `0.1` = 10% speed (best for very fast games like Snake)
- `2.0` = Double speed (harder testing)

**Example:**
```bash
qa-agent https://game.com --speed 0.2
```

**Note:** This works by adding `?speed=X` to the game URL. Only games that support this parameter will be affected.

### Pause-Step Mode (`--pause`) - DreamUp Games Only

**NEW:** For DreamUp games with pause/resume support, use pause-step mode for perfect LLM synchronization.

**Format:** `--pause <seconds>` where seconds is the game run duration between pauses.

**How it works:**
1. Game runs for X seconds
2. Game **pauses** automatically (via `window.gamePause()`)
3. LLM analyzes screenshot and decides action
4. Action executes while game is frozen
5. Game **resumes** (via `window.gameResume()`) for exactly X seconds
6. Repeat until game ends or max actions reached

**Examples:**
```bash
# Pause every 0.5 seconds (recommended)
qa-agent https://localhost:8080/snake/ --pause 0.5

# Pause every 1 second (more game progression per cycle)
qa-agent https://localhost:8080/pong/ --pause 1.0
```

**Benefits:**
- ✅ LLM has unlimited time to decide (no real-time pressure)
- ✅ Perfect synchronization between decisions and game state
- ✅ Better strategic gameplay
- ✅ No risk of game ending before LLM responds
- ✅ More predictable behavior

**Limitations:**
- ⚠️ Only works with DreamUp games (snake, pong) that have `window.gamePause()`/`window.gameResume()` functions
- ⚠️ Cannot use with `--speed` (mutually exclusive)
- ⚠️ Will gracefully ignore pause calls for third-party games

**Note:** This only works with games that support URL parameter speed control (like our example games). For games without this support, use `?testMode=true` if available.

### Test Timeout (`--timeout`, `-t`)

Control how long the test will run before timing out. Useful for testing or when you need shorter/longer test runs.

**Format:** `--timeout <milliseconds>`

**Default:** `300000` (5 minutes)

**Examples:**
```bash
# 1 minute timeout (for quick tests)
qa-agent https://game.com --timeout 60000

# 2 minutes
qa-agent https://game.com --timeout 120000

# 10 minutes (for complex games)
qa-agent https://game.com --timeout 600000
```

**What happens on timeout:**
- ✅ All collected screenshots are saved
- ✅ GIF is generated from captured frames
- ✅ Comprehensive report is created with playability score
- ✅ Test logs are preserved
- ⚠️ Status will be "PASS" if > 5 screenshots were captured, "FAIL" otherwise

**This is a graceful timeout!** No data loss - everything captured up to the timeout is preserved.

### Quick Test Mode (`--quick-test`)

**NEW:** Fast functional testing mode that presses all control keys without LLM analysis. Perfect for verifying input bindings work correctly.

**How it works:**
1. Extracts all keys from `--hints` (or uses defaults: arrows, WASD, space)
2. Presses each key in sequence with 500ms intervals
3. No LLM calls = much faster (30 seconds instead of 5 minutes)
4. Captures screenshots periodically
5. Report shows which keys were pressed and how many times

**Examples:**
```bash
# Quick test with input hints (30 seconds)
qa-agent https://game.com \
  --hints "gameBuilder.createAxis('Move').bindArrowKeys()" \
  --hints-type javascript \
  --quick-test

# Quick test with custom duration (10 seconds)
qa-agent https://game.com --hints "..." --quick-test --timeout 10000

# Quick test without hints (uses defaults)
qa-agent https://game.com --quick-test
```

**Default keys (when no hints provided):**
- Arrow keys: ArrowUp, ArrowDown, ArrowLeft, ArrowRight
- WASD: w, a, s, d  
- Space bar

**Use cases:**
- ✅ CI/CD verification ("do my controls work?")
- ✅ Rapid iteration during development
- ✅ Functional smoke testing before LLM testing
- ✅ Input binding validation

**Note:** Cannot be used with `--pause`, `--speed`, or `--model` (those are for LLM mode only).

### Thinking Mode (`--thinking`)

Enable reasoning/thinking mode for o1 models. This allows the model to spend more time reasoning before acting.

**Example:**
```bash
qa-agent https://game.com --model o1 --thinking
```

### Input Control Hints

Provide the AI with information about game controls:

**Semantic (default):**
```bash
--hints "Use arrow keys to move tiles"
```

**JavaScript:**
```bash
--hints "createAction('Jump').bindKey(' ')" --hints-type javascript
```

### Verbose Logging (`--verbose`, `-v`)

Enable detailed logging for debugging:
```bash
qa-agent https://game.com --verbose
```

### Output Directory (`--output`, `-o`)

Specify custom output directory:
```bash
qa-agent https://game.com --output ./my-test-results
```

## Quick Testing (Public Games)

Test with public games - no ngrok needed!

```bash
# Test 2048 with semantic hints
qa-agent https://gabrielecirulli.github.io/2048/ \
  --hints "Use arrow keys to move tiles in 4 directions" \
  --verbose

# Test 2048 with JavaScript-style hints
qa-agent https://gabrielecirulli.github.io/2048/ \
  --hints "createAxis2D('Move').bindArrowKeys()" \
  --hints-type javascript \
  --verbose

# Test with cheaper/faster model
qa-agent https://gabrielecirulli.github.io/2048/ \
  --hints "Use arrow keys to move tiles" \
  --model gpt-4o-mini \
  --verbose
```

## Testing Local DreamUp Games

### Setup: Pong & Snake Example Games

**1. Games are already in:** `tests/example-games/pong/` and `tests/example-games/snake/`

**2. Start local HTTP server:**
```bash
cd tests/example-games
python3 -m http.server 8080
# Keep this terminal running!
```

**3. In a NEW terminal, start ngrok tunnel:**
```bash
ngrok http 8080
# Copy the https URL (e.g., https://xxxx-xxxx-xxxx.ngrok-free.dev)
# Keep this terminal running too!
```

**4. Test the games:**

**Pong:**
```bash
# With test mode (10% speed) using URL parameter
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/pong/?testMode=true \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp'); gameBuilder.createAction('Pause').bindKey('Escape')" \
  --hints-type javascript \
  --verbose

# Or use --speed flag to control via URL (10% speed)
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp'); gameBuilder.createAction('Pause').bindKey('Escape')" \
  --hints-type javascript \
  --speed 0.1 \
  --verbose

# With faster model for quicker testing
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/pong/?testMode=true \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')" \
  --hints-type javascript \
  --model gpt-4o-mini \
  --verbose

# NEW: Pause-step mode (perfect synchronization, recommended!)
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')" \
  --hints-type javascript \
  --pause 0.5 \
  --verbose
```

**Snake:**
```bash
# With test mode (10% speed) using URL parameter
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/snake/?testMode=true \
  --hints "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --verbose

# Or use --speed flag to control via URL (10% speed)
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/snake/ \
  --hints "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --speed 0.1 \
  --verbose

# With reasoning model
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/snake/?testMode=true \
  --hints "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --model o1-mini \
  --thinking \
  --verbose

# NEW: Pause-step mode (perfect synchronization, recommended!)
qa-agent https://YOUR-NGROK-URL.ngrok-free.dev/snake/ \
  --hints "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --pause 0.5 \
  --verbose
```

## Using the Test Script

We've created a convenient test script:

```bash
# Make it executable (first time only)
chmod +x tests/run-tests.sh

# Run all tests
./tests/run-tests.sh

# Or run specific test suites
./tests/run-tests.sh public     # Only public games
./tests/run-tests.sh local      # Only local games (needs ngrok)
```

## Game Speed Configuration (NEW)

The Snake and Pong example games support configurable speed for AI testing:

### URL Parameters:

**`?testMode=true`** - Automatic slow mode optimized for AI testing:
- Snake: 25% speed (2000ms per move instead of 500ms)
- Pong: 40% speed (slower ball for better tracking)

**`?speed=<number>`** - Custom speed multiplier:
- `speed=1.0` - Normal speed (default)
- `speed=0.5` - Half speed
- `speed=0.25` - Quarter speed
- `speed=2.0` - Double speed (harder!)

### Why Use This?

LLM-based testing has ~2-3 second latency. By slowing the game down, the AI agent can:
- Make strategic decisions before the game state changes
- Actually play the game instead of dying immediately
- Provide meaningful playability scores

**Example:**
```bash
# Normal speed - AI will struggle
qa-agent https://your-url/snake/

# Test mode - AI can actually play
qa-agent https://your-url/snake/?testMode=true

# Custom speed - fine-tune for your needs
qa-agent https://your-url/pong/?speed=0.6
```

## Understanding Input Hints

### Semantic Hints (for third-party games)
Natural language description of controls:
```bash
--hints "Use arrow keys to move tiles in 4 directions"
--hints "WASD to move, spacebar to jump"
```

### JavaScript Hints (for DreamUp games)
Actual game engine code:
```bash
--hints "gameBuilder.createAction('Jump').bindKey(' ')" \
--hints-type javascript

--hints "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()" \
--hints-type javascript
```

### DreamUp Input Patterns

**Actions** (discrete button presses):
```javascript
gameBuilder.createAction('Jump')
  .bindKey(' ')
  .bindKey('w')
  .bindVirtualButton('#btn-jump');
```

**Axes** (1D continuous input):
```javascript
gameBuilder.createAxis('MoveHorizontal')
  .bindKeys('a', 'd')
  .bindKeys('ArrowLeft', 'ArrowRight');
```

**Axes 2D** (combined movement):
```javascript
gameBuilder.createAxis2D('Move')
  .bindWASD()
  .bindArrowKeys()
  .bindJoystick('#joystick');
```

## Programmatic API

Use the QA agent in your TypeScript/JavaScript code:

```typescript
import { runQA } from 'dreamup-qa-agent';

// With semantic hints
await runQA('https://example.com/game', {
  inputHints: {
    type: 'semantic',
    content: 'Use arrow keys to move'
  },
  verbose: true
});

// With JavaScript hints
await runQA('http://localhost:8080/pong/', {
  inputHints: {
    type: 'javascript',
    content: "gameBuilder.createAxis('Paddle').bindKeys('ArrowUp', 'ArrowDown')"
  },
  verbose: true
});
```

## Viewing Results

All test results are saved to:
```
output/
├── <game-url>_<timestamp>/
│   ├── screenshots/
│   │   ├── loading_*.png
│   │   ├── start_screen_*.png
│   │   ├── gameplay_*.png
│   │   └── game_over_*.png
│   ├── logs/
│   │   └── console-logs.json
│   └── qa-report.json
```

**Open results:**
```bash
# macOS
open output/<latest-folder>/

# Or view the JSON report
cat output/<latest-folder>/qa-report.json | jq
```

## Troubleshooting

### `zsh: command not found: qa-agent`
**Solution:** Run `npm link` from project root

### Font loading timeout on 2048game.com
**Solution:** Use `https://gabrielecirulli.github.io/2048/` instead

### Local game shows 404 or blocked
**Solution:** 
- Ensure HTTP server is running on port 8080
- Use ngrok tunnel URL (not localhost)
- Keep both terminals running (server + ngrok)

### ngrok authentication error
**Solution:** 
```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Input hints not working
**Solution:**
- Check logs with `--verbose` flag
- Look for "Parsed JavaScript input hints" or "Parsed semantic input hints"
- Verify hints match actual game controls
- For DreamUp games: check `game.js` for exact input binding code

## ngrok Important Notes

⚠️ **Your computer must stay running while testing local games!**

ngrok creates a tunnel: `Internet → ngrok servers → your localhost:8080`

- If you close the ngrok terminal, the URL stops working
- If you stop the HTTP server, the games won't load
- If you restart ngrok, you'll get a NEW URL (update your test commands)
- Free tier: URL changes each time you restart ngrok

## Test Checklist

- [ ] `npm link` completed
- [ ] `qa-agent --help` works
- [ ] Tested public game (2048)
- [ ] ngrok configured with authtoken
- [ ] HTTP server running (for local games)
- [ ] ngrok tunnel active (for local games)
- [ ] Tested Pong with JavaScript hints
- [ ] Results visible in `output/` folder

## Example Session

```bash
# Terminal 1: Start HTTP server
cd tests/example-games
python3 -m http.server 8080

# Terminal 2: Start ngrok
ngrok http 8080
# Copy the https URL

# Terminal 3: Run tests
qa-agent https://abc123.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')" \
  --hints-type javascript \
  --verbose

# View results
open output/*pong*/
```

## Need Help?

- Check verbose logs: `--verbose` flag
- View Browserbase session: Look for "debugUrl" in output
- Check console logs: `output/<session>/logs/console-logs.json`
- Verify game loads: Visit ngrok URL in your browser first

