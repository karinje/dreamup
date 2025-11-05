# DreamUp QA Agent - Demo Guide

> **AI-Powered Autonomous Browser Game Testing**

---

## 📋 Pre-Demo Setup

### Terminal 1: Local Server
```bash
cd /Users/sanjaykarinje/git/dreamup/tests/example-games
python3 -m http.server 8080
```

### Terminal 2: ngrok Tunnel
```bash
ngrok http 8080
# Copy the URL (e.g., https://xxx.ngrok-free.dev)
```

### Terminal 3: Dashboard
```bash
cd /Users/sanjaykarinje/git/dreamup/viewer
npm run dev
# Open http://localhost:5173
```

### One-Time Setup
```bash
cd /Users/sanjaykarinje/git/dreamup
npm run build && npm link
```

---

## 🎯 Demo Flow

### 1. Introduction

**Say:**
> "DreamUp QA Agent is an AI-powered autonomous browser game testing tool. It uses Browserbase (cloud Chrome), Stagehand (browser automation), and GPT-4o (decision making) to test web games like a human player would."

**Show Architecture:**
```
Developer → QA Agent →  LLM  -> Stagehand → Browserbase (Cloud Chrome) 
                 ↓
            Live Dashboard
```

---

### 2. Quick Test Mode - Functional Verification

**Say:**
> "Let's start with Quick Test mode - fast input verification without LLM calls."

**Run:**
```bash
qa-agent https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')" \
  --hints-type javascript \
  --quick-test \
  --timeout 60000
```

**Highlight:**
- ✅ LLM handles navigation (modal, start button)
- ✅ Then rapid random key presses (no LLM)
- ✅ Fast & cheap ($0.01 vs $0.50)
- ✅ Perfect for smoke testing inputs
- ✅ **⚡ Quick Test** badge in dashboard

---

### 3. LLM-Driven Mode with Pause-Step

**Say:**
> "Now, full LLM-driven testing. Problem: LLM response latency while the game runs at 60fps. Solution: Pause-Step mode."

**Explain Pause-Step:**
```
Game paused → Screenshot → LLM analyzes → Resume + execute action → 
Wait 0.5s → Pause again → Repeat
```

**Run:**
```bash
qa-agent https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/snake/ \
  --hints "gameBuilder.createAxis('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --pause 0.5 \
  --timeout 180000 \
  --model gpt-4o
```

**Highlight:**
- 🎮 Game pauses every 0.5s for LLM to decide
- 🧠 LLM gets **temporal context** (last 3 frames) to understand direction
- 🎯 Strategic decision making (avoid walls, chase food)
- 🎨 **Pause: 0.5s** badge in dashboard
- 📊 Score: 77/100, collected food, eventually hit wall

---

### 4. Input Control Hints - The Key Feature

**Say:**
> "Input hints are the bridge between the game builder and QA agent. Two formats:"

#### A. JavaScript Snippet (First-Party Games)
```bash
qa-agent https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('Move').bindWASD().bindArrowKeys()" \
  --hints-type javascript \
  --quick-test
```

#### B. Semantic Description (Third-Party Games)
```bash
qa-agent https://play2048.co \
  --hints "Use arrow keys to move tiles. Try to merge tiles to reach 2048." \
  --hints-type semantic \
  --quick-test
```

**Highlight:**
- ✅ LLM sees **exact controls** in prompt
- ✅ Prioritizes testing specified keys
- ✅ Better strategic decisions
- ✅ **✓ Input Hints** badge in dashboard

---

### 5. Game Context for Complex Strategy

**Say:**
> "For games needing specific strategy, add game context."

**Run:**
```bash
qa-agent https://electroacoustic-lashawnda-unlunar.ngrok-free.dev/pong/ \
  --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')" \
  --hints-type javascript \
  --pause 0.25 \
  --timeout 120000 \
  --context "You control the RIGHT paddle. Track the ball's Y position and velocity. Move your paddle to intercept. React early - the ball moves fast."
```

**Highlight:**
- 🧠 Custom strategy injected into LLM prompt
- 🎯 Understands which paddle to control
- ⚡ Reacts faster with explicit instructions
- ✅ **✓ Game Context** badge in dashboard

---

### 6. Dashboard Deep Dive

**Navigate to:** `http://localhost:5173`

**Point out:**

#### Test Configuration Badges
- Timeout, Pause, Speed, Model
- Input Hints, Game Context, Quick Test

#### Gameplay GIF
- Visual proof of test execution
- Shows LLM decision-making in action

#### Screenshot Timeline
- Frame-by-frame analysis
- Temporal context visualization (T-2, T-1, T)

#### LLM Evaluation
- ✅ Loaded Successfully
- ✅ Controls Responsive
- ✅ Game Stable
- ✅ UI Visible
- 📊 Confidence score
- 📝 Observations & Issues

#### Playability Score
- 0-100 scoring system
- Based on multiple criteria

---

### 7. All Configuration Options

**Cheat Sheet:**

```bash
# Quick functional test
qa-agent <URL> --quick-test

# Model selection
qa-agent <URL> --model gpt-4o              # Smart (default)
qa-agent <URL> --model gpt-4o-mini         # Fast/cheap

# Speed control (non-DreamUp games)
qa-agent <URL> --speed 10                  # 10% speed

# Pause-step (DreamUp games only)
qa-agent <URL> --pause 0.5                 # Pause every 0.5s

# Timeout
qa-agent <URL> --timeout 180000            # 180 seconds

# Input hints
qa-agent <URL> --hints "..." --hints-type javascript
qa-agent <URL> --hints "..." --hints-type semantic

# Game context (strategy)
qa-agent <URL> --context "You control right paddle..."

# Verbose logging
qa-agent <URL> --verbose

# Output directory
qa-agent <URL> --output ./my-tests
```

---

### 8. Live Demo Results

**Show in Dashboard:**

| Test | Mode | Score | Key Insights |
|------|------|-------|--------------|
| Pong Quick | ⚡ Quick Test | 100/100 | All inputs verified |
| Snake LLM | 🎮 Pause 0.5s | 77/100 | Collected food, strategic movement |
| Pong Context | 🧠 + Context | 85/100 | Better paddle control |

---

### 9. Closing

**Say:**
> "DreamUp QA Agent bridges the gap between game builders and automated testing by:
> 
> 1. **Accepting input control hints** from the game engine
> 2. **Using LLM** for human-like decision making
> 3. **Adapting to game speed** with pause-step mode
> 4. **Providing comprehensive visual reports**"

**Show:** Dashboard with multiple test reports side-by-side

---

## 💡 Q&A Topics

### Cost?
- **Quick test:** ~$0.01 (2-3 LLM calls for navigation only)
- **Full LLM run:** ~$0.50 (100+ LLM calls for gameplay)

### Speed?
- **Quick test:** Very fast (navigation + random inputs)
- **LLM mode:** Depends on timeout setting

### Accuracy?
- Depends on game complexity
- Temporal context significantly helps
- Game-specific context improves performance by ~15-20%

### Limitations?
- Pause-step mode works best with DreamUp games (pause control)
- LLM response latency requires pause mode for fast-paced games
- Cost scales with test duration

### Browserbase?
- Cloud-based Chrome instances
- No local browser needed
- Consistent testing environment
- Free tier available

### Stagehand?
- Smart wrapper around Playwright
- Natural language → browser actions
- LLM-powered element detection
- Handles dynamic UIs gracefully

---

## 🚀 Quick Commands Reference

### Setup
```bash
# One-time
npm run build && npm link

# Start services
python3 -m http.server 8080  # Terminal 1
ngrok http 8080              # Terminal 2
cd viewer && npm run dev     # Terminal 3
```

### Test Commands
```bash
# Quick functional test
qa-agent <URL> --quick-test --timeout 60000

# LLM with pause mode
qa-agent <URL> --pause 0.5 --timeout 180000 --model gpt-4o

# Full featured test
qa-agent <URL> \
  --hints "..." --hints-type javascript \
  --pause 0.5 --timeout 180000 \
  --context "..." --model gpt-4o
```

### Environment
```bash
# Check .env file
OPENAI_API_KEY=sk-...
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...
```

---

## 📊 Demo Success Metrics

- ✅ 3 different test modes demonstrated
- ✅ Real games tested successfully
- ✅ Dashboard visualizations shown
- ✅ GIFs generated for all tests
- ✅ Cost and performance explained
- ✅ Architecture clearly illustrated

---

**Built with:** TypeScript, Browserbase, Stagehand, GPT-4o, Playwright

**Documentation:** See `README.md` and `tests/TEST_GUIDE.md`

