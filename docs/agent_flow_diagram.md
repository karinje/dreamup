# DreamUp QA Agent - Flow Diagram

**Legend:** 🔵 Blue = LLM Operations | 🟢 Green = Browser Automation | 🟡 Yellow = Data Processing

```mermaid
flowchart TD
    Start([🚀 Start Test]) --> S1
    
    S1["`🟢 **STAGE 1: INITIALIZE**
    Browser Setup & Game Loading
    • Launch headless Chrome 1280×720
    • Load game URL, wait for network idle`"]
    
    S2["`🔵 **STAGE 2: OBSERVE**
    LLM Calls #1-2
    • Detect & dismiss modals (cookies, age verify)
    • Find & click Start/Play button`"]
    
    S1 --> S2
    S2 --> ModeDecision{**Test Mode?**}
    
    ModeDecision -->|Normal LLM| S3Normal["`🔵 **STAGE 3: INTERACT**
    **Normal LLM Mode**
    Loop: LLM decides each action dynamically
    • Screenshot while game running
    • LLM analyzes (last 3 frames + context)
    • LLM decides next keys to press
    • Execute keys, wait 1s
    
    **~50 LLM calls (adaptive decisions)**
    **Cost: ~$0.50**`"]
    
    ModeDecision -->|Pause Mode| S3Pause["`🔵 **STAGE 3: INTERACT**
    **Pause Mode** (DreamUp games)
    Loop: LLM decides each action dynamically
    • Pause game at current frame
    • Screenshot frozen state
    • LLM analyzes (last 3 frames + context)
    • LLM decides next keys to press
    • Resume + execute keys immediately
    
    **~50 LLM calls (adaptive decisions)**
    **Perfect sync, no latency**`"]
    
    ModeDecision -->|Quick Test| S3Quick["`🟢 **STAGE 3: INTERACT**
    **Quick Test Mode**
    Loop ~50 actions:
    • Screenshot for evidence
    • Random key selection
    • Execute key, wait 0.5s
    
    **NO LLM calls**
    **Cost: ~$0.01**
    **Fast functional verification**`"]
    
    S3Normal --> S4
    S3Pause --> S4
    S3Quick --> S4
    
    S4["`🟢 **STAGE 4: MONITOR**
    Exit Conditions (checked each loop)
    • Page unresponsive
    • Game over detected
    • Max 50 actions reached
    • 5 minute timeout`"]
    
    S4 -->|Continue| ModeDecision
    S4 -->|Exit| S5
    
    S5["`🔵 **STAGE 5: EVALUATE**
    
    **Evidence Collection:**
    • All screenshots (8-50)
    • Action history, console logs
    
    **LLM Call #53:** 🔵
    Send 5 screenshots + context
    Returns: {loaded, ui_visible, controls_responsive, stable, confidence, issues}
    
    **Score Calculation:**
    Base = loaded(30%) + controls(30%) + stable(30%) + ui(10%)
    Penalties = Critical(-30) + High(-15) + Medium(-7) + Low(-3)
    Final = (Base - Penalties) × Confidence
    
    **Status:** pass(≥60) | fail(30-59) | error(<30)`"]
    
    S5 --> S6
    
    S6["`⚪ **STAGE 6: REPORT**
    Generate QAReport JSON:
    • status, playability_score, confidence_score
    • issues[], screenshots[], logs[]
    • metadata (duration, browser, LLM model, test_config)
    • Optional: gameplay.gif (2 FPS, max 60s)
    
    Save to: output/{session-id}/qa-report.json`"]
    
    S6 --> End([✅ Return QAReport])
    
    %% Styling
    style S1 fill:#90EE90,color:#000,stroke:#333,stroke-width:3px
    style S2 fill:#87CEEB,color:#000,stroke:#333,stroke-width:3px
    style S3Normal fill:#87CEEB,color:#000,stroke:#333,stroke-width:3px
    style S3Pause fill:#87CEEB,color:#000,stroke:#333,stroke-width:3px
    style S3Quick fill:#90EE90,color:#000,stroke:#333,stroke-width:3px
    style S4 fill:#90EE90,color:#000,stroke:#333,stroke-width:3px
    style S5 fill:#87CEEB,color:#000,stroke:#333,stroke-width:3px
    style S6 fill:#E0E0E0,color:#000,stroke:#333,stroke-width:3px
    style ModeDecision fill:#DDA0DD,color:#000,stroke:#333,stroke-width:3px
    style Start fill:#667eea,color:#fff,stroke:#333,stroke-width:2px
    style End fill:#43e97b,color:#000,stroke:#333,stroke-width:2px
```

## Mode Comparison

| Aspect | Normal LLM | Pause Mode | Quick Test |
|--------|-----------|------------|------------|
| **LLM Calls** | ~52 calls | ~52 calls | **3 calls** |
| **Cost** | $0.40-0.60 | $0.40-0.60 | **$0.02-0.03** |
| **Gameplay** | LLM-driven | LLM-driven (paused) | Random keys |
| **Duration** | 45-60s | 45-60s | **30-45s** |
| **Use Case** | 3rd-party games | DreamUp games | Fast verification |

## Key Differentiators

### Stage 3 (INTERACT) - The Critical Difference
- **Normal LLM & Pause Mode**: 🔵 LLM makes **adaptive decisions** for each action
  - Analyzes last 3 frames for velocity/direction
  - Reviews action history for context
  - Dynamically decides next keys to press
  - ~50 LLM calls → ~$0.50/test
- **Quick Test**: 🟢 Random key selection, no LLM analysis during gameplay (~$0.01)
- **All modes**: 🔵 Use identical LLM evaluation at the end for scoring

### Stage 5 (EVALUATE) - Score Components
```
Base Score (0-100):
  ✅ Loaded (30%) + ✅ Controls (30%) + ✅ Stable (30%) + ✅ UI Visible (10%)

Penalties:
  ❌ Critical (-30) | High (-15) | Medium (-7) | Low (-3)

Final Score:
  (Base - Penalties) × LLM Confidence → Clamped to [0, 100]

Status:
  pass (≥60) | fail (30-59) | error (<30 or has critical issues)
```

