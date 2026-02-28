import { exportToBlob } from "@excalidraw/excalidraw";

const DB_NAME = 'liva-thumbnails';
const STORE_NAME = 'thumbnails';
const DB_VERSION = 1;

interface CachedThumbnail {
    cacheKey: string; // noteId-theme
    noteId: string;
    theme: 'dark' | 'light';
    updatedAt: number;
    dataUrl: string;
    createdAt: number;
}

// In-flight generation tracking to prevent duplicate work
const inFlightGenerations = new Map<string, Promise<string | null>>();

// In-memory cache for faster access (cleared on page refresh)
const memoryCache = new Map<string, { dataUrl: string; updatedAt: number }>();

/**
 * Create cache key from noteId and theme
 */
function makeCacheKey(noteId: string, theme: 'dark' | 'light'): string {
    return `${noteId}-${theme}`;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION + 1); // Bump version for schema change
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            // Delete old store if exists (schema changed from noteId to cacheKey)
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
            store.createIndex('noteId', 'noteId', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
        };
    });
}

/**
 * Get cached thumbnail from IndexedDB
 */
async function getCachedThumbnail(noteId: string, updatedAt: number, theme: 'dark' | 'light'): Promise<string | null> {
    const cacheKey = makeCacheKey(noteId, theme);
    
    // Check memory cache first
    const memCached = memoryCache.get(cacheKey);
    if (memCached && memCached.updatedAt >= updatedAt) {
        return memCached.dataUrl;
    }

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(cacheKey);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cached = request.result as CachedThumbnail | undefined;
                if (cached && cached.updatedAt >= updatedAt) {
                    // Update memory cache
                    memoryCache.set(cacheKey, { dataUrl: cached.dataUrl, updatedAt: cached.updatedAt });
                    resolve(cached.dataUrl);
                } else {
                    resolve(null); // Stale or not found
                }
            };
        });
    } catch (error) {
        console.error('Failed to get cached thumbnail:', error);
        return null;
    }
}

/**
 * Save thumbnail to IndexedDB
 */
async function saveThumbnail(noteId: string, updatedAt: number, theme: 'dark' | 'light', dataUrl: string): Promise<void> {
    const cacheKey = makeCacheKey(noteId, theme);
    
    // Update memory cache
    memoryCache.set(cacheKey, { dataUrl, updatedAt });

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            const entry: CachedThumbnail = {
                cacheKey,
                noteId,
                theme,
                updatedAt,
                dataUrl,
                createdAt: Date.now(),
            };
            
            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to save thumbnail:', error);
    }
}

/**
 * Generate thumbnail from Excalidraw elements
 */
async function generateThumbnailFromElements(
    elements: any[],
    isDarkMode: boolean
): Promise<string | null> {
    try {
        const visibleElements = elements.filter((el) => !el.isDeleted);
        
        if (visibleElements.length === 0) {
            return null;
        }

        const blob = await exportToBlob({
            elements: visibleElements,
            appState: {
                exportWithDarkMode: isDarkMode,
            },
            files: {},
            mimeType: "image/png",
            quality: 0.5,
        });

        if (!blob) return null;

        // Convert blob to data URL for storage
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        return null;
    }
}

/**
 * Main API: Get or generate thumbnail for a board
 * - Checks cache first (separate caches for dark/light themes)
 * - If miss/stale, fetches board and generates thumbnail
 * - Deduplicates in-flight requests for same board+theme
 */
export async function getThumbnail(
    noteId: string,
    updatedAt: number,
    fetchBoard: () => Promise<{ excalidrawElements?: any[] } | null>,
    isDarkMode: boolean
): Promise<string | null> {
    const theme: 'dark' | 'light' = isDarkMode ? 'dark' : 'light';
    
    // Check cache first (theme-specific)
    const cached = await getCachedThumbnail(noteId, updatedAt, theme);
    if (cached) {
        return cached;
    }

    // Check if already generating (include theme in dedup key)
    const inflightKey = `${noteId}-${updatedAt}-${theme}`;
    const inFlight = inFlightGenerations.get(inflightKey);
    if (inFlight) {
        return inFlight;
    }

    // Generate new thumbnail
    const generationPromise = (async () => {
        try {
            const board = await fetchBoard();
            
            if (!board?.excalidrawElements || board.excalidrawElements.length === 0) {
                return null;
            }

            const dataUrl = await generateThumbnailFromElements(
                board.excalidrawElements,
                isDarkMode
            );

            if (dataUrl) {
                await saveThumbnail(noteId, updatedAt, theme, dataUrl);
            }

            return dataUrl;
        } catch (error) {
            console.error('Failed to generate thumbnail for board:', noteId, error);
            return null;
        } finally {
            inFlightGenerations.delete(inflightKey);
        }
    })();

    inFlightGenerations.set(inflightKey, generationPromise);
    return generationPromise;
}

/**
 * Clear all cached thumbnails (useful for debugging)
 */
export async function clearThumbnailCache(): Promise<void> {
    memoryCache.clear();
    
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to clear thumbnail cache:', error);
    }
}
