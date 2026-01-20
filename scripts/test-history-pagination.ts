// @ts-nocheck

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

// Node 18+ has built-in fetch, so we don't need node-fetch

import { type AppRouter } from '../server/trpc';

const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: 'http://localhost:8787/api/v1',
            headers: {
                'X-LIVA-USER-ID': 'test-user-123',
            },
        }),
    ],
});

async function runTest() {
    console.log('Starting History Pagination Test...');

    // 1. Create a note
    const noteId = `test-history-${Date.now()}`;
    console.log(`Creating note: ${noteId}`);
    await client.createNote.mutate({
        id: noteId,
        title: 'Initial Title',
        blob: { content: 'Initial Content' },
    });

    // 2. Create multiple versions
    const totalVersions = 15;
    console.log(`Creating ${totalVersions} versions...`);
    for (let i = 1; i <= totalVersions; i++) {
        await client.updateNote.mutate({
            id: noteId,
            title: `Title v${i}`,
            blob: { content: `Content v${i}` },
        });
        // Small delay to ensure timestamp differences if needed, though version is what matters
        await new Promise(r => setTimeout(r, 50));
    }

    // 3. Test Pagination
    console.log('\nTesting Pagination (Limit 5, Descending)...');

    // Page 1
    const page1 = await client.getHistory.query({
        id: noteId,
        limit: 5,
        direction: 'desc',
    });
    console.log(`Page 1 items: ${page1.items.length}, Next Cursor: ${page1.nextCursor}`);
    console.log('Page 1 Versions:', page1.items.map(i => i.version));

    if (page1.items.length !== 5) throw new Error('Page 1 length incorrect');
    if (!page1.nextCursor) throw new Error('Page 1 should have next cursor');

    // Page 2
    const page2 = await client.getHistory.query({
        id: noteId,
        limit: 5,
        cursor: page1.nextCursor,
        direction: 'desc',
    });
    console.log(`Page 2 items: ${page2.items.length}, Next Cursor: ${page2.nextCursor}`);
    console.log('Page 2 Versions:', page2.items.map(i => i.version));

    if (page2.items.length !== 5) throw new Error('Page 2 length incorrect');

    // Page 3
    const page3 = await client.getHistory.query({
        id: noteId,
        limit: 5,
        cursor: page2.nextCursor,
        direction: 'desc',
    });
    console.log(`Page 3 items: ${page3.items.length}, Next Cursor: ${page3.nextCursor}`);
    console.log('Page 3 Versions:', page3.items.map(i => i.version));

    // Page 4 (Should be mostly empty or just the initial creation if we have 16 versions total: 1 create + 15 updates = 16 versions)
    // Versions are: 1 (initial), 2..16 (updates)
    // Total 16 versions.
    // Page 1: 16, 15, 14, 13, 12
    // Page 2: 11, 10, 9, 8, 7
    // Page 3: 6, 5, 4, 3, 2
    // Page 4: 1

    const page4 = await client.getHistory.query({
        id: noteId,
        limit: 5,
        cursor: page3.nextCursor,
        direction: 'desc',
    });
    console.log(`Page 4 items: ${page4.items.length}, Next Cursor: ${page4.nextCursor}`);
    console.log('Page 4 Versions:', page4.items.map(i => i.version));

    if (page4.items.length !== 1) throw new Error('Page 4 length incorrect');
    if (page4.nextCursor !== null) throw new Error('Page 4 should not have next cursor');

    console.log('\nTest Passed Successfully!');
}

runTest().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
