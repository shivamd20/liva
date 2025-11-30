const USER_ID_KEY = 'liva-user-id';

/**
 * Generate a unique user identifier (UUID v4 style)
 */
function generateUserId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create the unique user identifier
 * Stored in localStorage for persistence across sessions
 */
export function getUserId(): string {
    let userId = localStorage.getItem(USER_ID_KEY);

    if (!userId) {
        userId = generateUserId();
        localStorage.setItem(USER_ID_KEY, userId);
    }

    return userId;
}

/**
 * Clear the user identifier (useful for testing)
 */
export function clearUserId(): void {
    localStorage.removeItem(USER_ID_KEY);
}
