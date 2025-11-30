#!/bin/bash

# Test script for Notes API with Durable Objects

BASE_URL="http://localhost:8788/api/v1"

echo "=== Testing Notes API with Durable Objects ==="
echo

# Test 1: Create a note
echo "1. Creating a note..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/createNote" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Note",
    "blob": {"content": "Hello from Durable Objects!"}
  }')
echo "Response: $CREATE_RESPONSE"
NOTE_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created note ID: $NOTE_ID"
echo

# Test 2: Get the note
echo "2. Getting the note..."
GET_RESPONSE=$(curl -s -G "$BASE_URL/getNote" \
  --data-urlencode "input={\"id\":\"$NOTE_ID\"}")
echo "Response: $GET_RESPONSE"
echo

# Test 3: Update the note
echo "3. Updating the note..."
UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/updateNote" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$NOTE_ID\",
    \"title\": \"Updated Note\",
    \"blob\": {\"content\": \"Updated content\"}
  }")
echo "Response: $UPDATE_RESPONSE"
echo

# Test 4: Get history
echo "4. Getting note history..."
HISTORY_RESPONSE=$(curl -s -G "$BASE_URL/getHistory" \
  --data-urlencode "input={\"id\":\"$NOTE_ID\"}")
echo "Response: $HISTORY_RESPONSE"
echo

# Test 5: List notes
echo "5. Listing all notes..."
LIST_RESPONSE=$(curl -s "$BASE_URL/listNotes")
echo "Response: $LIST_RESPONSE"
echo

echo "=== Tests Complete ==="
