
/**
 * Standalone function to create a new board via the API.
 * This effectively calls the `createNote` tRPC mutation via HTTP.
 */
export async function createExcalidrawBoard(title: string = 'Untitled'): Promise<string> {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const endpoint = `${protocol}//${host}/api/v1/createNote`;

    const payload = {
        title,
        blob: {
            excalidrawElements: [],
            content: ''
        }
    };

    // Generate a random user ID for public/demo creation if not authenticated
    // In a real app, this should come from your auth provider
    const demoUserId = `demo-user-${Math.floor(Math.random() * 100000)}`;

    // Correct tRPC HTTP payload for batch mode without transformer:
    // Body: { "0": payload }

    const response = await fetch(`${endpoint}?batch=1`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-LIVA-USER-ID': demoUserId
        },
        body: JSON.stringify({
            "0": payload
        })
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('Create board failed:', text);
        throw new Error(`Failed to create board: ${response.statusText}`);
    }

    const result = await response.json();

    // Parse tRPC response: [ { result: { data: NoteCurrent } } ]
    const data = (result as any)[0]?.result?.data;

    if (!data || !data.id) {
        console.error('Invalid response:', result);
        throw new Error('Invalid response from server');
    }

    return data.id;
}
