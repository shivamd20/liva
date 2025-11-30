#!/bin/bash

# Simple WebSocket Test Script
# Tests the WebSocket functionality manually

echo "🧪 WebSocket Manual Test Guide"
echo "================================"
echo ""
echo "This script will guide you through testing WebSocket functionality."
echo ""
echo "Prerequisites:"
echo "  1. Development server must be running: npm run dev"
echo "  2. Server should be at http://localhost:8787"
echo ""
echo "Test Steps:"
echo ""
echo "Step 1: Create a test note"
echo "----------------------------"
echo "Run this command:"
echo ""
echo 'curl -X POST http://localhost:8787/api/v1/createNote \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"id":"ws-test-note","title":"WebSocket Test","blob":{"content":"Initial"}}'"'"
echo ""
echo "Step 2: Open WebSocket test page"
echo "----------------------------"
echo "Open test-websocket.html in your browser"
echo "  - Enter note ID: ws-test-note"
echo "  - Click Connect"
echo "  - You should see the initial note state"
echo ""
echo "Step 3: Update the note"
echo "----------------------------"
echo "Run this command (or click Update in the HTML page):"
echo ""
echo 'curl -X POST http://localhost:8787/api/v1/updateNote \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"id":"ws-test-note","title":"Updated!","blob":{"content":"Updated content"}}'"'"
echo ""
echo "Step 4: Verify"
echo "----------------------------"
echo "Check the browser - you should see the update appear in real-time!"
echo ""
echo "Step 5: Test multiple clients"
echo "----------------------------"
echo "  1. Open test-websocket.html in multiple browser tabs"
echo "  2. Connect all tabs to the same note ID"
echo "  3. Update from one tab"
echo "  4. All tabs should receive the update instantly"
echo ""
echo "================================"
echo ""
echo "Press Enter to create the test note now, or Ctrl+C to exit..."
read

# Create test note
echo ""
echo "Creating test note..."
curl -X POST http://localhost:8787/api/v1/createNote \
  -H "Content-Type: application/json" \
  -d '{"id":"ws-test-note","title":"WebSocket Test","blob":{"content":"Initial content","timestamp":'$(date +%s)'}}'

echo ""
echo ""
echo "✅ Test note created!"
echo ""
echo "Now:"
echo "  1. Open test-websocket.html in your browser"
echo "  2. Enter note ID: ws-test-note"
echo "  3. Click Connect"
echo "  4. Click Update Note to see real-time updates"
echo ""
