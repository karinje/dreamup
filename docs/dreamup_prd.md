# Product Requirements Document: DreamUp Browser Game QA Pipeline

## Document Control
- **Product Name:** DreamUp QA Agent
- **Version:** 1.1
- **Date:** November 4, 2025
- **Owner:** Matt Smith
- **Status:** In Development
- **Project Duration:** 3-5 days (core) + 2 days (stretch features)
- **Change Log:**
  - v1.1 (Nov 4): Added F1.3b Input Control Hints, updated API interfaces, added US-1.0
  - v1.0 (Nov 3): Initial PRD from project specification

---

## Executive Summary

### Product Vision
An autonomous AI-powered QA agent that tests browser-based games through simulated user interactions, visual analysis, and intelligent evaluation—enabling automated quality assurance for AI-generated games and creating feedback loops for continuous improvement of game-building agents.

### Problem Statement
Currently, DreamUp's AI game generator lacks automated quality assurance capabilities. Manual testing is time-consuming, inconsistent, and doesn't scale. Game developers need immediate feedback on whether generated games are playable, stable, and meet basic quality standards.

### Solution
A fully automated QA pipeline that accepts any browser game URL, simulates realistic user interactions, captures visual evidence, and produces structured quality reports using AI-powered analysis.

### Success Metrics
- **Primary:** Successfully test 3+ diverse browser games with 80%+ accuracy on playability assessment
- **Secondary:** Average test completion time < 5 minutes per game
- **Quality:** Handle common failure modes gracefully (crashes, slow loads, rendering issues)
- **Developer Experience:** Clean, documented, modular codebase ready for production integration

---

## Product Overview

### Target Users

#### Primary Users
1. **Game Development Agent (Automated)**
   - Invokes QA agent programmatically after game generation
   - Consumes structured JSON output for self-improvement
   - Runs in AWS Lambda environment

2. **DreamUp Engineers**
   - Debug and validate QA agent behavior
   - Review test reports for system improvements
   - Configure and deploy QA pipeline

#### Secondary Users
3. **Game Developers (Future)**
   - Manual QA testing of custom browser games
   - Batch testing of game portfolios

### Use Cases

**Primary Use Case:** Automated Post-Generation QA
- Game-building agent generates browser game
- Invokes QA agent with game URL
- Receives structured pass/fail report within 5 minutes
- Uses feedback to improve next generation attempt

**Secondary Use Cases:**
- Manual QA of existing browser games
- Regression testing of game templates
- Comparative analysis across multiple game versions

---

## Game Engine Context (v1.3)

### Scene Stack Architecture

DreamUp's game engine uses a scene-based architecture with four types:
- **Canvas2D & Canvas3D**: Full ECS runtimes with physics, rendering, and game logic
- **UI scenes**: Pure DOM elements for menus and overlays
- **Composite scenes**: Layer multiple child scenes together

Games are represented as a stack of scenes with push/pop operations. A common pattern is a composite scene containing a 2D/3D game scene with a UI overlay for the HUD. UI scenes can suspend scenes beneath them (e.g., pause menus), while composite scenes manage suspension state and propagate lifecycle calls (mount, unmount, update, draw) to all children.

### Input System Architecture

The input system uses a two-layer architecture:

**Low-level**: Hardware capture (keys, mouse, pointer)

**High-level**: Gameplay abstractions
- **Actions**: Map multiple inputs to named gameplay events (e.g., "Jump")
  - Track states: pressed, down, released, hold duration
  - Bind to keyboard keys, mouse buttons, or virtual buttons
  - Example: `createAction('Jump').bindKey(' ').bindVirtualButton('#btn-jump')`

- **Axes**: Provide continuous values for movement
  - **1D Axes**: Return [-1, 1] with smoothing and opposite-direction cancellation
  - **2D Axes**: Return vectors {x, y} with diagonal normalization
  - Bind to WASD, arrow keys, virtual joysticks, D-pads
  - Example: `createAxis2D('Move').bindWASD().bindArrowKeys()`

Actions and axes decouple game logic from hardware—multiple input sources trigger the same action or axis, allowing keyboard, touch, and virtual controls to work interchangeably. Game code queries these abstractions through a scene's InputManager.

### QA Agent Integration

The game-building agent picks the input schema during game planning. For QA testing:
- **First-party games**: Provide JavaScript snippet showing exact input schema
- **Third-party games**: Provide semantic description (e.g., "arrow keys for movement")
- The QA agent uses these hints to prioritize control schemes during testing

---

## Functional Requirements

### Core Features (MVP - Days 1-5)

#### F1: Browser Automation Agent

**F1.1 Game Loading**
- **Requirement:** Load any web-hosted game URL in headless browser environment
- **Acceptance Criteria:**
  - Successfully loads games from itch.io, Kongregate, HTML5Games.com
  - Handles HTTP/HTTPS protocols
  - Detects page load completion (DOM ready + network idle)
  - Timeout after 60 seconds if game fails to load
  
**F1.2 UI Pattern Detection**
- **Requirement:** Identify and interact with common game UI elements
- **Acceptance Criteria:**
  - Detects start/play buttons (text-based and image-based)
  - Identifies game menus and navigation elements
  - Recognizes game over screens
  - Handles modal dialogs and overlays

**F1.3 Game Navigation**
- **Requirement:** Autonomously walk through game based on discovered controls
- **Acceptance Criteria:**
  - Identifies available control schemes (keyboard, mouse, touch)
  - Executes contextually appropriate actions
  - Progresses through 2-3 screens/levels when possible
  - Avoids infinite loops with max action count limit

**F1.3b Input Control Hints (NEW - v1.3)**
- **Requirement:** Accept optional input control hints to guide interaction strategy
- **Acceptance Criteria:**
  - Accepts JavaScript snippet describing first-party game input schema (Actions/Axes pattern)
  - Accepts semantic description for third-party games (e.g., "arrow keys for movement, spacebar to jump")
  - Uses hints to prioritize specific control schemes during testing
  - Falls back to auto-detection if provided hints fail or are incomplete
  - Supports both discrete Actions (Jump, Shoot, Interact) and continuous Axes (MoveHorizontal, Move2D)
  - Parses game engine input patterns: createAction(), createAxis(), bindKeys(), bindVirtualButton()

**F1.4 Resilience & Error Handling**
- **Requirement:** Handle failures gracefully without crashing
- **Acceptance Criteria:**
  - Retry failed loads up to 3 times with exponential backoff
  - Max execution time: 5 minutes per game
  - Continue testing if non-critical failures occur
  - Log all errors with timestamps and context

#### F2: Evidence Capture System

**F2.1 Screenshot Capture**
- **Requirement:** Take 3-5 timestamped screenshots per test session
- **Acceptance Criteria:**
  - Baseline screenshot after initial load
  - Action screenshots during key interactions
  - Final state screenshot before completion
  - PNG format, stored in structured directory
  - Filenames include timestamp and action context

**F2.2 Log Collection**
- **Requirement:** Capture browser console logs and error messages
- **Acceptance Criteria:**
  - Record all console.error messages
  - Capture JavaScript exceptions
  - Log network errors (404, 500, timeout)
  - Include timestamps for correlation with screenshots

**F2.3 Artifact Organization**
- **Requirement:** Save all test evidence to structured output directory
- **Acceptance Criteria:**
  - Directory structure: `output/{game-id}/{timestamp}/`
  - Separate folders for screenshots, logs, and reports
  - Include metadata file with test configuration
  - Preserve artifacts for post-test analysis

#### F3: AI-Powered Evaluation

**F3.1 Visual Analysis**
- **Requirement:** Use LLM to analyze screenshots for game state
- **Acceptance Criteria:**
  - Evaluates whether game loaded successfully
  - Assesses visual quality and rendering issues
  - Detects frozen frames or blank screens
  - Identifies error messages in screenshots

**F3.2 Playability Assessment**
- **Requirement:** Determine if game meets basic playability standards
- **Acceptance Criteria:**
  - Evaluates control responsiveness
  - Checks for game progression (not stuck)
  - Assesses stability (no crashes/freezes)
  - Provides confidence score (0-100%) for each assessment

**F3.3 Structured Output**
- **Requirement:** Generate comprehensive JSON report
- **Acceptance Criteria:**
  - Standardized schema for all test results
  - Includes pass/fail status, scores, and detailed findings
  - Lists all discovered issues with severity levels
  - References screenshot artifacts
  - Timestamp and test duration included

#### F4: Execution Interface

**F4.1 TypeScript Execution**
- **Requirement:** Run as TypeScript file compatible with Lambda environment
- **Acceptance Criteria:**
  - Executes with `bun run qa.ts` or `npx tsx qa.ts`
  - Accepts game URL as command-line argument
  - Returns structured JSON to stdout
  - Exit codes: 0 (success), 1 (test failed), 2 (system error)

**F4.2 Programmatic API**
- **Requirement:** Callable as module from Node.js environment
- **Acceptance Criteria:**
  ```typescript
  interface TestOptions {
    timeout?: number;
    retryCount?: number;
    inputHints?: {
      type: 'javascript' | 'semantic';
      content: string;
    };
  }
  
  const result = await runQA(gameUrl, options);
  // Returns: Promise<QAReport>
  ```
  - Async/await compatible
  - Configurable timeout and retry options
  - Optional input hints for first-party or third-party games
  - Type-safe interfaces

**F4.3 Output Schema**
- **Requirement:** Consistent JSON structure for all results
- **Acceptance Criteria:**
  ```json
  {
    "status": "pass|fail|error",
    "playability_score": 0-100,
    "issues": [
      {
        "type": "error|warning|info",
        "description": "string",
        "screenshot": "path/to/screenshot.png",
        "timestamp": "ISO-8601"
      }
    ],
    "screenshots": ["path1.png", "path2.png"],
    "timestamp": "ISO-8601",
    "duration_ms": 123456,
    "game_url": "https://...",
    "test_id": "uuid"
  }
  ```

### Stretch Features (Optional - Days 6-7)

#### F5: Enhanced Evidence Capture

**F5.1 GIF Recording**
- **Requirement:** Capture gameplay as animated GIF
- **Acceptance Criteria:**
  - Records 10-30 seconds of gameplay
  - Max file size: 10MB
  - Frame rate: 10-15 FPS
  - Included in test artifacts

**F5.2 Performance Metrics**
- **Requirement:** Monitor game performance during testing
- **Acceptance Criteria:**
  - Track average FPS
  - Measure page load time
  - Record memory usage trends
  - Detect performance degradation over time

**F5.3 Accessibility Checks**
- **Requirement:** Basic accessibility evaluation
- **Acceptance Criteria:**
  - Verify keyboard navigation support
  - Check color contrast ratios
  - Detect missing alt text on images
  - Validate ARIA labels

#### F6: Batch Testing

**F6.1 Multi-Game Execution**
- **Requirement:** Test multiple games sequentially
- **Acceptance Criteria:**
  - Accepts CSV or JSON file with game URLs
  - Runs tests in sequence with cooldown periods
  - Generates individual reports per game
  - Creates aggregated summary report

**F6.2 Comparative Analysis**
- **Requirement:** Compare results across multiple tests
- **Acceptance Criteria:**
  - Identifies common failure patterns
  - Ranks games by playability score
  - Generates trend analysis for repeated tests
  - Exports comparison as CSV/JSON

#### F7: Web Dashboard

**F7.1 Test History Viewer**
- **Requirement:** Simple web UI for viewing test results
- **Acceptance Criteria:**
  - Lists all completed tests with timestamps
  - Displays test status, scores, and key metrics
  - Allows filtering by status, date, game URL
  - Click to view detailed report

**F7.2 Report Viewer**
- **Requirement:** Interactive display of individual test results
- **Acceptance Criteria:**
  - Shows all screenshots in chronological order
  - Displays logs with syntax highlighting
  - Presents issues with severity badges
  - Allows downloading artifacts as ZIP

**F7.3 Live Testing Interface**
- **Requirement:** Trigger new tests from web interface
- **Acceptance Criteria:**
  - Form to submit game URL
  - Live progress updates during test execution
  - Real-time screenshot preview
  - Notification when test completes

---

## User Stories

### Epic 1: Core Browser Automation

**US-1.0: Accept Input Hints** (NEW - v1.3)
```
As a game-building agent
I want to provide input control hints to the QA agent
So that testing focuses on the correct control scheme

Acceptance Criteria:
- Given I've generated a game with specific input controls
- When I invoke the QA agent with JavaScript snippet or semantic hints
- Then the agent prioritizes testing those specific controls
- And falls back to auto-detection if hints are incomplete
- And reports which controls were discovered via hints vs auto-detection
```

**US-1.1: Load Game**
```
As a QA agent
I want to load a browser game from any URL
So that I can begin automated testing

Acceptance Criteria:
- Given a valid game URL
- When I initialize the browser agent
- Then the game loads within 60 seconds
- And I capture a baseline screenshot
- And I log any console errors
```

**US-1.2: Detect Start Button**
```
As a QA agent
I want to automatically find and click the start/play button
So that I can begin gameplay without manual intervention

Acceptance Criteria:
- Given a loaded game with a start screen
- When I analyze the page structure
- Then I identify the primary action button
- And I click it successfully
- And the game transitions to gameplay state
```

**US-1.3: Simulate Gameplay**
```
As a QA agent
I want to simulate realistic user inputs (keyboard, mouse)
So that I can test game responsiveness and progression

Acceptance Criteria:
- Given an active game session
- When I identify the control scheme
- Then I execute appropriate input sequences
- And I capture screenshots of resulting game states
- And I avoid repeating actions infinitely
```

**US-1.4: Handle Failures**
```
As a QA agent
I want to gracefully handle crashes and errors
So that testing completes even when games are buggy

Acceptance Criteria:
- Given a game that crashes or freezes
- When the error occurs
- Then I log the error with full context
- And I attempt recovery if possible
- And I complete the test with "fail" status
- And I don't crash the QA system itself
```

### Epic 2: Evidence Collection

**US-2.1: Capture Screenshots**
```
As a game developer
I want screenshots of key moments during testing
So that I can visually verify what happened

Acceptance Criteria:
- Given a test in progress
- When significant actions occur
- Then screenshots are captured automatically
- And saved with descriptive filenames
- And referenced in the final report
```

**US-2.2: Collect Logs**
```
As a QA engineer
I want comprehensive console and error logs
So that I can debug issues discovered during testing

Acceptance Criteria:
- Given a browser game session
- When errors or warnings occur
- Then all messages are captured with timestamps
- And organized in a readable format
- And correlated with screenshot evidence
```

### Epic 3: AI Evaluation

**US-3.1: Assess Game Load**
```
As an AI evaluator
I want to analyze screenshots to determine if a game loaded successfully
So that I can provide accurate load status

Acceptance Criteria:
- Given baseline and gameplay screenshots
- When I analyze visual content
- Then I determine if game rendered properly
- And I detect common load failures (blank screen, error messages)
- And I provide a confidence score
```

**US-3.2: Evaluate Playability**
```
As a game-building agent
I want a playability score for my generated game
So that I know if it meets quality standards

Acceptance Criteria:
- Given all test evidence (screenshots, logs, interactions)
- When AI evaluation runs
- Then I receive a score from 0-100
- And a list of specific issues found
- And recommendations for improvement
```

**US-3.3: Generate Report**
```
As a developer
I want a structured JSON report of test results
So that I can programmatically process QA outcomes

Acceptance Criteria:
- Given a completed test
- When report generation runs
- Then I receive valid JSON matching the schema
- And all required fields are populated
- And artifact paths are correct and accessible
```

### Epic 4: Integration & Deployment

**US-4.1: Lambda Execution**
```
As a game-building agent running in Lambda
I want to invoke the QA agent programmatically
So that I can automate testing after game generation

Acceptance Criteria:
- Given a Lambda function environment
- When I call the QA agent with a game URL
- Then the test completes within Lambda timeout limits
- And results are returned as structured JSON
- And artifacts are uploaded to S3 or similar storage
```

**US-4.2: CLI Usage**
```
As a QA engineer
I want to run tests from the command line
So that I can manually test games during development

Acceptance Criteria:
- Given a terminal environment
- When I run `qa-agent <game-url>`
- Then the test executes with live progress updates
- And results are printed to stdout
- And artifacts are saved to local filesystem
```

### Epic 5: Stretch Features

**US-5.1: GIF Recording**
```
As a game developer
I want an animated GIF of gameplay
So that I can quickly see game behavior without clicking through screenshots

Acceptance Criteria:
- Given a test in progress
- When gameplay is active
- Then a GIF is recorded for 10-30 seconds
- And included in test artifacts
- And file size stays under 10MB
```

**US-5.2: Batch Testing**
```
As a QA engineer
I want to test multiple games in one command
So that I can efficiently QA entire game libraries

Acceptance Criteria:
- Given a list of game URLs
- When I run batch mode
- Then all games are tested sequentially
- And individual reports are generated
- And a summary report aggregates results
```

**US-5.3: Web Dashboard**
```
As a QA engineer
I want a web interface to view test history
So that I can easily browse and share results with my team

Acceptance Criteria:
- Given the dashboard is running
- When I open it in a browser
- Then I see a list of all tests
- And I can click to view detailed reports
- And I can trigger new tests from the UI
```

---

## Non-Functional Requirements

### Performance
- **NFR-1:** Test execution completes in < 5 minutes per game
- **NFR-2:** System can run 10+ tests sequentially without degradation
- **NFR-3:** Screenshot capture adds < 5 seconds to test duration
- **NFR-4:** LLM evaluation completes in < 30 seconds

### Reliability
- **NFR-5:** 95% success rate on loading non-broken games
- **NFR-6:** Zero crashes of QA agent (graceful failure only)
- **NFR-7:** All artifacts successfully saved 99% of the time

### Scalability
- **NFR-8:** Architecture supports parallel execution (future)
- **NFR-9:** Artifact storage scales to 1000+ tests
- **NFR-10:** Memory usage stays under 2GB per test

### Security
- **NFR-11:** No execution of untrusted code outside browser sandbox
- **NFR-12:** API keys stored securely (environment variables)
- **NFR-13:** Test artifacts don't leak sensitive information

### Usability
- **NFR-14:** Setup time < 15 minutes for new developers
- **NFR-15:** Documentation covers all core features
- **NFR-16:** Error messages are actionable and clear

### Maintainability
- **NFR-17:** Code follows TypeScript best practices
- **NFR-18:** Core modules have < 300 lines each
- **NFR-19:** Public APIs have TypeScript type definitions
- **NFR-20:** Logging is comprehensive and structured

---

## Technical Requirements

### Technology Stack

**Required:**
- **Runtime:** Node.js 18+, Bun, or compatible
- **Language:** TypeScript (preferred) or JavaScript
- **Browser Automation:** Browserbase + Stagehand (recommended)
- **LLM Framework:** Vercel AI SDK (preferred)
- **Testing:** Diverse browser games from itch.io, Kongregate, HTML5Games.com

**Optional (Stretch):**
- **GIF Encoding:** gifencoder or puppeteer-recorder
- **Dashboard:** Next.js, React, or similar
- **Storage:** Local filesystem (core), S3 (production)

### Architecture Requirements

**TR-1: Modular Design**
- Separate concerns: browser control, evidence capture, AI evaluation
- Each module independently testable
- Clear interfaces between components

**TR-2: Error Boundaries**
- Each major operation wrapped in try-catch
- Errors logged with full context
- Partial failures don't prevent test completion

**TR-3: Configuration**
- Timeouts, retry counts, and limits configurable
- Support environment variables for API keys
- Defaults work out-of-box for testing

**TR-4: Observability**
- Structured logging (JSON format preferred)
- Progress updates during execution
- Metrics for performance monitoring

### Integration Requirements

**IR-1: Lambda Compatibility**
- Runs in Node.js Lambda runtime
- Respects Lambda memory and timeout constraints
- Handles cold starts gracefully

**IR-2: Output Format**
- Valid JSON conforming to documented schema
- No extraneous output to stdout
- Artifacts referenced by relative paths

**IR-3: Dependency Management**
- All dependencies in package.json
- No undocumented system requirements
- Lockfile (package-lock.json or bun.lockb) included

---

## Test Plan

### Test Scenarios

#### TS-1: Simple Puzzle Game
**Description:** Basic click interactions (e.g., tic-tac-toe)
**Expected Results:**
- Game loads successfully
- Agent identifies and clicks cells
- Detects win/loss/draw states
- Playability score > 70%

#### TS-2: Platformer Game
**Description:** Keyboard controls with physics (e.g., Mario clone)
**Expected Results:**
- Agent identifies arrow keys/WASD controls
- Simulates movement and jumping
- Progresses through at least one level segment
- Captures screenshots of character movement

#### TS-3: Idle/Clicker Game
**Description:** Minimal interaction, persistent state
**Expected Results:**
- Agent clicks primary action button repeatedly
- Detects state changes (score, resources)
- Verifies game doesn't freeze
- Completes test in < 3 minutes

#### TS-4: Broken Game
**Description:** Intentionally buggy test case
**Expected Results:**
- Detects load failure or critical errors
- Status: "fail"
- Issues array contains error descriptions
- System doesn't crash, test completes

#### TS-5: Complex Game
**Description:** Multiple levels/screens (e.g., RPG demo)
**Expected Results:**
- Agent navigates through 2+ screens
- Handles dialogs and menus
- Evidence captures progression
- Playability score reflects complexity handling

### Quality Gates

**QG-1: Functional Testing**
- All core features (F1-F4) pass manual testing
- 3 out of 5 test scenarios complete successfully
- No critical bugs in error handling

**QG-2: Code Quality**
- TypeScript compiles without errors
- Linter passes with zero warnings
- Code coverage > 60% (if tests written)

**QG-3: Documentation**
- README includes setup, usage, and examples
- Architecture documented with diagrams
- All public functions have JSDoc comments

**QG-4: Demo**
- 2-5 minute video shows end-to-end execution
- Video includes at least 2 different game types
- Demonstrates both successful and failed tests

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Agent loops infinitely on certain games | Medium | High | Implement max action count (50-100 actions), 5-minute hard timeout, action history tracking |
| LLM gives inconsistent evaluations | Medium | Medium | Use structured prompts with examples, confidence thresholds, fallback to heuristic rules |
| Games require specific browser features | Low | Medium | Test with multiple browser engines, document limitations |
| Browserbase rate limits or costs | Low | Medium | Implement local caching, use free tier efficiently, fallback to Playwright |
| Screenshots fail to capture game state | Low | High | Multiple screenshot attempts, validate image data, fallback to DOM analysis |

### Project Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep delays core delivery | High | High | Strict 5-day deadline for core features, stretch features only after |
| Insufficient test game diversity | Medium | Medium | Curate test suite early, include edge cases |
| Integration with Lambda complex | Low | Medium | Test locally first, document Lambda-specific requirements |
| API costs exceed budget | Low | Low | Use model caching, cheaper models for iteration, local testing |

---

## Dependencies

### External Services
- **Browserbase** (or alternative browser automation service)
- **OpenAI/Anthropic/Groq** (LLM provider)
- **Game hosting platforms** (itch.io, Kongregate, etc.)

### Internal Dependencies
- Access to AWS Lambda for testing integration
- Budget for API costs (estimated $10-50 for development)

### Development Dependencies
- Node.js/Bun development environment
- TypeScript toolchain
- Git for version control

---

## Success Criteria & KPIs

### Launch Criteria (Core MVP)
- ✅ All core features (F1-F4) implemented and functional
- ✅ Successfully tests 3+ diverse browser games
- ✅ Generates valid JSON reports with correct schema
- ✅ Handles common failures without crashing
- ✅ Documented setup and usage in README
- ✅ Demo video completed

### Post-Launch KPIs (If Deployed)
- **Test Success Rate:** > 90% of tests complete without system errors
- **Accuracy:** > 80% agreement with human QA assessments
- **Performance:** Average test time < 4 minutes
- **Adoption:** Used for 50+ game tests in first month
- **Developer Satisfaction:** Net Promoter Score > 7/10

---

## Timeline & Milestones

| Milestone | Target Date | Deliverables |
|-----------|------------|--------------|
| M1: Basic Agent | Day 1 | Browser launches, loads URL, captures screenshots |
| M2: Interaction System | Day 2 | Button detection, keyboard/mouse simulation working |
| M3: AI Integration | Day 3 | LLM evaluation integrated, JSON output format |
| M4: Robustness | Day 4 | Error handling complete, tested on 3+ games |
| M5: Core Complete | Day 5 | Documentation, code cleanup, demo video |
| M6: Stretch Features | Days 6-7 | Optional: GIF recording, batch mode, or dashboard |

---

## Open Questions

1. **Q:** Should we support authentication-required games?
   **A:** Out of scope for v1; assume all games publicly accessible

2. **Q:** What's the preferred LLM provider?
   **A:** Flexible; Vercel AI SDK supports multiple providers

3. **Q:** How to handle games that require audio?
   **A:** Visual-only analysis for v1; audio out of scope

4. **Q:** Storage for test artifacts in production?
   **A:** Prototype uses local filesystem; production TBD (likely S3)

5. **Q:** Support for WebGL-intensive games?
   **A:** Best effort; document limitations if performance issues arise

---

## Appendix

### A: Example Output Schema
```typescript
interface QAReport {
  test_id: string;
  game_url: string;
  timestamp: string; // ISO-8601
  duration_ms: number;
  status: 'pass' | 'fail' | 'error';
  playability_score: number; // 0-100
  issues: Issue[];
  screenshots: string[]; // Relative paths
  logs: LogEntry[];
  metadata: {
    browser: string;
    viewport: { width: number; height: number };
    user_agent: string;
  };
}

interface Issue {
  type: 'error' | 'warning' | 'info';
  category: string; // e.g., 'load_failure', 'unresponsive_controls'
  description: string;
  screenshot?: string;
  timestamp: string;
  severity: number; // 1-5
}

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  source: string; // e.g., 'console', 'network', 'agent'
}
```

### B: Recommended Project Structure
```
dreamup-qa-agent/
├── src/
│   ├── agent/
│   │   ├── browser.ts          # Browser automation
│   │   ├── interactions.ts     # UI interaction logic
│   │   └── navigation.ts       # Page navigation
│   ├── evidence/
│   │   ├── screenshots.ts      # Screenshot capture
│   │   ├── logs.ts             # Log collection
│   │   └── artifacts.ts        # Artifact management
│   ├── evaluation/
│   │   ├── llm.ts              # LLM integration
│   │   ├── prompts.ts          # Evaluation prompts
│   │   └── scoring.ts          # Playability scoring
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   ├── config.ts           # Configuration
│   │   ├── logger.ts           # Logging utilities
│   │   └── errors.ts           # Error handling
│   └── qa.ts                   # Main entry point
├── tests/
│   ├── fixtures/               # Test games
│   └── integration/            # Integration tests
├── output/                     # Test artifacts
├── docs/
│   ├── architecture.md
│   └── api.md
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

### C: Reference Links
- [Browserbase Documentation](https://www.browserbase.com/docs)
- [Stagehand NPM Package](https://www.npmjs.com/package/@browserbasehq/stagehand)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Test Games: itch.io HTML5](https://itch.io/games/html5)
- [Test Games: Kongregate](https://www.kongregate.com/)
- [DreamUp Sample Games](https://drive.google.com/file/d/1InNc6v5pWvRu-TXWlMA-XjEi2XBX8h63/view?usp=drive_link) (2 examples)

### D: Input Schema Reference

The DreamUp game engine uses a specific pattern for defining input controls. The QA agent should be able to parse this format when provided as a hint.

**Example Input Schema** (from project overview v1.3):
```javascript
// Actions - discrete button events
gameBuilder.createAction('Jump')
  .bindKey(' ')
  .bindKey('w')
  .bindVirtualButton('#btn-jump');

// Axes - horizontal movement (-1 to 1)
gameBuilder.createAxis('MoveHorizontal')
  .bindKeys('a', 'd')
  .bindKeys('ArrowLeft', 'ArrowRight')
  .bindButtons('#dpad .dpad-left', '#dpad .dpad-right')
  .setSmoothing(0.15);

// 2D Axes - combined directional input (normalized)
gameBuilder.createAxis2D('Move')
  .bindWASD()
  .bindArrowKeys()
  .bindJoystick('#joystick')
  .setSmoothing(0.2);
```

Key methods to recognize:
- `createAction(name)` - discrete button press
- `createAxis(name)` - 1D continuous input
- `createAxis2D(name)` - 2D vector input
- `bindKey(key)` - keyboard binding
- `bindKeys(negKey, posKey)` - axis with negative/positive keys
- `bindVirtualButton(selector)` - DOM element button
- `bindWASD()` / `bindArrowKeys()` - common presets
- `setSmoothing(value)` - input smoothing factor

---

**Document Version History**
- v1.1 (Nov 4, 2025): Added Game Engine Context, Input Control Hints (F1.3b), updated API, added US-1.0, added Appendix D
- v1.0 (Nov 3, 2025): Initial PRD created from project specification