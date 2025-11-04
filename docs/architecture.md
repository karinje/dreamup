graph TB
    subgraph "Entry Points"
        CLI[CLI Interface<br/>cli.ts]
        API[Programmatic API<br/>api.ts]
        Lambda[Lambda Handler<br/>examples/lambda-handler.ts]
    end

    subgraph "Orchestrator"
        Main[Main Orchestrator<br/>index.ts]
    end

    subgraph "Agent Module"
        Browser[Browser Controller<br/>agent/browser.ts]
        Interactions[UI Interactions<br/>agent/interactions.ts]
        Navigation[Game Navigation<br/>agent/navigation.ts]
    end

    subgraph "Evidence Module"
        Screenshots[Screenshot Capture<br/>evidence/screenshots.ts]
        Logs[Log Collection<br/>evidence/logs.ts]
        Storage[Artifact Storage<br/>evidence/storage.ts]
        Recorder[GIF Recorder<br/>evidence/recorder.ts<br/><i>Optional</i>]
    end

    subgraph "Evaluation Module"
        Analyzer[LLM Analyzer<br/>evaluation/analyzer.ts]
        Prompts[Prompt Templates<br/>evaluation/prompts.ts]
        Scoring[Playability Scoring<br/>evaluation/scoring.ts]
    end

    subgraph "Utilities"
        Config[Configuration<br/>utils/config.ts]
        Logger[Structured Logger<br/>utils/logger.ts]
        Errors[Error Handling<br/>utils/errors.ts]
        Retry[Retry Logic<br/>utils/retry.ts]
    end

    subgraph "External Services"
        Browserbase[Browserbase<br/>Browser Automation]
        LLM[LLM Provider<br/>OpenAI/Anthropic/Groq]
        GameURL[Game URL<br/>itch.io/Kongregate/etc]
    end

    subgraph "Outputs"
        Report[QA Report JSON]
        ArtifactsDir[Screenshots & Logs<br/>output/]
    end

    CLI --> Main
    API --> Main
    Lambda --> API
    
    Main --> Browser
    Main --> Navigation
    Main --> Analyzer
    Main --> Config
    Main --> Logger
    
    Browser --> Browserbase
    Browser --> GameURL
    Browser --> Screenshots
    Browser --> Logs
    Browser --> Retry
    
    Navigation --> Interactions
    Navigation --> Browser
    Navigation --> Screenshots
    
    Interactions --> Browser
    Interactions --> Screenshots
    
    Screenshots --> Storage
    Logs --> Storage
    Recorder --> Storage
    
    Analyzer --> LLM
    Analyzer --> Prompts
    Analyzer --> Screenshots
    Analyzer --> Logs
    
    Scoring --> Analyzer
    
    Main --> Scoring
    Main --> Report
    
    Storage --> ArtifactsDir
    Report --> ArtifactsDir
    
    Config --> Logger
    Errors --> Logger

    style Main fill:#4a90e2,stroke:#2e5c8a,color:#fff
    style CLI fill:#50c878,stroke:#2d7a4a,color:#fff
    style API fill:#50c878,stroke:#2d7a4a,color:#fff
    style Report fill:#f39c12,stroke:#c87f0a,color:#fff
    style Recorder fill:#ddd,stroke:#999,color:#333
    style Lambda fill:#50c878,stroke:#2d7a4a,color:#fff