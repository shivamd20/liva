
export interface UserProfile {
    id: string;
    username: string;
    avatarUrl: string;
    color: {
        background: string;
        stroke: string;
    };
}

const COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', 
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', 
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', 
    '#FF5722', '#795548', '#607D8B'
];

const ADJECTIVES = [
    'Happy', 'Lucky', 'Sunny', 'Clever', 'Brave', 'Calm', 
    'Swift', 'Bright', 'Cool', 'Kind', 'Wild', 'Quiet',
    'Super', 'Hyper', 'Mega', 'Ultra', 'Rapid', 'Grand'
];

const NOUNS = [
    'Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox', 'Wolf', 
    'Bear', 'Hawk', 'Lion', 'Owl', 'Cat', 'Dog',
    'Whale', 'Shark', 'Cobra', 'Viper', 'Raven', 'Crow'
];

// In-memory storage
let storedUserId: string | null = null;
let storedUserProfile: UserProfile | null = null;

function getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomColor() {
    const color = getRandomItem(COLORS);
    return { background: color, stroke: color };
}

function generateRandomName() {
    return `${getRandomItem(ADJECTIVES)} ${getRandomItem(NOUNS)}`;
}

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
 * Stored in memory for the current session
 */
export function getUserId(): string {
    if (!storedUserId) {
        storedUserId = generateUserId();
    }
    return storedUserId;
}

/**
 * Get or create the full user profile
 * Stored in memory for the current session
 */
export function getUserProfile(): UserProfile {
    if (storedUserProfile) {
        return storedUserProfile;
    }

    const id = getUserId(); // Reuse or create ID
    const username = generateRandomName();
    // Use the ID as seed for consistent avatar if we regenerated just the name, 
    // or just random seed. Let's use a random seed or username as seed.
    // Using username as seed ensures name matches avatar somewhat.
    const seed = username.replace(' ', ''); 
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    const color = generateRandomColor();

    storedUserProfile = {
        id,
        username,
        avatarUrl,
        color
    };

    return storedUserProfile;
}

/**
 * Clear the user identifier (useful for testing)
 */
export function clearUserId(): void {
    storedUserId = null;
    storedUserProfile = null;
}
