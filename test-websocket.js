/**
 * WebSocket Test Script
 * Tests real-time note updates via WebSocket
 * 
 * Usage: node test-websocket.js [base-url]
 * Example: node test-websocket.js http://localhost:8787
 */

const WebSocket = require('ws');

const BASE_URL = process.argv[2] || 'http://localhost:8787';
const WS_URL = BASE_URL.replace('http', 'ws');
const NOTE_ID = 'test-note-' + Date.now();

console.log('🧪 WebSocket Note Test');
console.log('='.repeat(50));
console.log(`Base URL: ${BASE_URL}`);
console.log(`Note ID: ${NOTE_ID}`);
console.log('='.repeat(50));

let ws;
let messageCount = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createNote() {
    console.log('\n📝 Creating note...');
    const response = await fetch(`${BASE_URL}/api/v1/createNote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: NOTE_ID,
            title: 'WebSocket Test Note',
            blob: { content: 'Initial content', version: 1 }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Note created:', result.result.data);
    return result.result.data;
}

async function updateNote(version) {
    console.log(`\n📝 Updating note (version ${version})...`);
    const response = await fetch(`${BASE_URL}/api/v1/updateNote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: NOTE_ID,
            title: `Updated Title v${version}`,
            blob: { 
                content: `Updated content v${version}`,
                timestamp: Date.now()
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Note updated:', result.result.data);
    return result.result.data;
}

function connectWebSocket() {
    return new Promise((resolve, reject) => {
        console.log(`\n🔌 Connecting to WebSocket: ${WS_URL}/ws/note/${NOTE_ID}`);
        
        ws = new WebSocket(`${WS_URL}/ws/note/${NOTE_ID}`);

        ws.on('open', () => {
            console.log('✅ WebSocket connected');
            resolve();
        });

        ws.on('message', (data) => {
            messageCount++;
            const message = JSON.parse(data.toString());
            console.log(`\n📨 Message #${messageCount} received:`, {
                type: message.type,
                noteId: message.data.id,
                version: message.data.version,
                title: message.data.title,
                updatedAt: new Date(message.data.updatedAt).toISOString()
            });
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            console.log('\n🔌 WebSocket disconnected');
        });

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
}

async function runTest() {
    try {
        // Step 1: Create a note
        await createNote();
        await sleep(500);

        // Step 2: Connect WebSocket
        await connectWebSocket();
        await sleep(1000);

        // Step 3: Update note multiple times
        console.log('\n🔄 Starting updates...');
        for (let i = 2; i <= 4; i++) {
            await sleep(1500);
            await updateNote(i);
        }

        // Step 4: Wait for messages
        await sleep(2000);

        // Step 5: Close WebSocket
        console.log('\n🔌 Closing WebSocket...');
        ws.close();
        await sleep(500);

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('✅ Test completed successfully!');
        console.log(`📊 Total WebSocket messages received: ${messageCount}`);
        console.log('Expected: 4 messages (1 initial + 3 updates)');
        console.log('='.repeat(50));

        if (messageCount >= 4) {
            console.log('✅ All messages received!');
            process.exit(0);
        } else {
            console.log('⚠️  Some messages may be missing');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (ws) ws.close();
        process.exit(1);
    }
}

// Run the test
runTest();
