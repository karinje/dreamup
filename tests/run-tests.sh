#!/bin/bash

# DreamUp QA Agent - Consolidated Test Runner
# Usage:
#   ./tests/run-tests.sh          # Run all tests
#   ./tests/run-tests.sh public   # Only public games
#   ./tests/run-tests.sh local    # Only local games (requires ngrok)

set -e

cd "$(dirname "$0")/.."

echo "🎮 DreamUp QA Agent - Test Runner"
echo "=================================="
echo ""

# Check if qa-agent is available
if ! command -v qa-agent &> /dev/null; then
    echo "❌ Error: qa-agent command not found"
    echo ""
    echo "Run these commands first:"
    echo "  npm run build"
    echo "  npm link"
    echo ""
    exit 1
fi

# Determine test mode
TEST_MODE="${1:-all}"

run_public_tests() {
    echo "📦 PUBLIC GAMES TEST SUITE"
    echo "=========================="
    echo ""
    
    echo "Test 1: 2048 with Semantic Hints"
    echo "---------------------------------"
    qa-agent https://gabrielecirulli.github.io/2048/ \
      --hints "Use arrow keys to move tiles in 4 directions" \
      --verbose
    
    echo ""
    echo "✅ Test 1 complete!"
    echo ""
    
    if [ "$TEST_MODE" != "public" ]; then
        read -p "Press Enter to continue..."
        echo ""
    fi
    
    echo "Test 2: 2048 with JavaScript Hints"
    echo "-----------------------------------"
    qa-agent https://gabrielecirulli.github.io/2048/ \
      --hints "createAxis2D('Move').bindArrowKeys()" \
      --hints-type javascript \
      --verbose
    
    echo ""
    echo "✅ Test 2 complete!"
    echo ""
}

run_local_tests() {
    echo "🏠 LOCAL GAMES TEST SUITE"
    echo "========================="
    echo ""
    
    # Check if ngrok is running
    if ! curl -s http://localhost:4040/api/tunnels &> /dev/null; then
        echo "❌ Error: ngrok is not running"
        echo ""
        echo "Start ngrok in another terminal:"
        echo "  cd tests/example-games"
        echo "  python3 -m http.server 8080"
        echo ""
        echo "Then in another terminal:"
        echo "  ngrok http 8080"
        echo ""
        exit 1
    fi
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)
    
    if [ -z "$NGROK_URL" ]; then
        echo "❌ Error: Could not get ngrok URL"
        exit 1
    fi
    
    echo "✅ Found ngrok tunnel: $NGROK_URL"
    echo ""
    
    # Test Pong
    if [ -d "tests/example-games/pong" ]; then
        echo "Test 3: Pong with JavaScript Hints (Test Mode - Slow Speed)"
        echo "------------------------------------------------------------"
        qa-agent "$NGROK_URL/pong/?testMode=true" \
          --hints "gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp'); gameBuilder.createAction('Pause').bindKey('Escape')" \
          --hints-type javascript \
          --verbose
        
        echo ""
        echo "✅ Test 3 complete!"
        echo ""
        
        if [ "$TEST_MODE" != "local" ]; then
            read -p "Press Enter to continue..."
            echo ""
        fi
    else
        echo "⚠️  Pong game not found at tests/example-games/pong/"
        echo ""
    fi
    
    # Test Snake
    if [ -d "tests/example-games/snake" ]; then
        echo "Test 4: Snake with JavaScript Hints (Test Mode - Slow Speed)"
        echo "-------------------------------------------------------------"
        
        # Check if we can find the controls in snake/game.js
        if [ -f "tests/example-games/snake/game.js" ]; then
            echo "📝 Reading snake controls from game.js..."
            # You can manually update this after inspecting the file
            SNAKE_HINTS="gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()"
        else
            SNAKE_HINTS="createAxis2D('Move').bindArrowKeys()"
        fi
        
        qa-agent "$NGROK_URL/snake/?testMode=true" \
          --hints "$SNAKE_HINTS" \
          --hints-type javascript \
          --verbose
        
        echo ""
        echo "✅ Test 4 complete!"
        echo ""
    else
        echo "⚠️  Snake game not found at tests/example-games/snake/"
        echo ""
    fi
}

# Run tests based on mode
case "$TEST_MODE" in
    public)
        run_public_tests
        ;;
    local)
        run_local_tests
        ;;
    all)
        run_public_tests
        if [ "$TEST_MODE" != "public" ]; then
            read -p "Press Enter to start local tests (make sure ngrok is running)..."
            echo ""
        fi
        run_local_tests
        ;;
    *)
        echo "❌ Invalid test mode: $TEST_MODE"
        echo ""
        echo "Usage:"
        echo "  ./tests/run-tests.sh          # Run all tests"
        echo "  ./tests/run-tests.sh public   # Only public games"
        echo "  ./tests/run-tests.sh local    # Only local games"
        echo ""
        exit 1
        ;;
esac

echo ""
echo "🎉 ALL TESTS COMPLETE!"
echo "======================"
echo ""
echo "📊 View results:"
echo "  open output/"
echo ""
echo "📝 View latest report:"
echo "  cat output/\$(ls -t output/ | head -1)/qa-report.json | jq"
echo ""

