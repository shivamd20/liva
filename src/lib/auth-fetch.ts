/**
 * Auth-aware fetch wrapper that:
 * 1. Waits for session to be ready before making requests
 * 2. Retries on 401 after waiting for auth refresh
 * 
 * This prevents race conditions where API calls happen before anonymous login completes.
 */
import { authClient } from "./auth-client";

/** Maximum retries for 401 errors */
const MAX_401_RETRIES = 2;

/** Maximum retries for 5xx and network errors (total attempts = 1 + this) */
const MAX_5XX_NETWORK_RETRIES = 2;

/** Backoff in ms before retrying after 5xx or network error */
const RETRY_BACKOFF_MS = 1000;

/** Timeout for waiting for auth (ms) */
const AUTH_WAIT_TIMEOUT = 10000;

/** 
 * Promise that resolves when auth session is ready.
 * Resets when session is lost.
 */
let authReadyPromise: Promise<void> | null = null;
let authReadyResolve: (() => void) | null = null;

/**
 * Initialize or get the auth ready promise.
 * Called internally - waits for session to exist.
 */
function getAuthReadyPromise(): Promise<void> {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      authReadyResolve = resolve;
    });

    // Start polling for session
    checkSessionReady();
  }
  return authReadyPromise;
}

/**
 * Check if session is ready and resolve the promise.
 */
// Flag to prevent multiple sign-in attempts
let isSigningIn = false;

/**
 * Check if session is ready and resolve the promise.
 * If no session exists, attempts anonymous sign-in.
 */
async function checkSessionReady(): Promise<void> {
  try {
    const session = await authClient.getSession();
    if (session.data?.user) {
      // Session is ready
      if (authReadyResolve) {
        authReadyResolve();
        authReadyResolve = null;
      }
      return;
    }

    // No session found, attempt anonymous sign-in
    if (!isSigningIn) {
      isSigningIn = true;
      console.log("[authFetch] No session found, attempting anonymous sign-in...");
      try {
        await authClient.signIn.anonymous();
      } catch (err) {
        console.error("[authFetch] Anonymous sign-in failed:", err);
      } finally {
        isSigningIn = false;
      }
    }
  } catch (err) {
    // Ignore errors, will retry
    console.error("[authFetch] Error checking session:", err);
  }

  // Not ready yet, poll again
  setTimeout(checkSessionReady, 500);
}

/**
 * Reset auth ready state (call when session is lost).
 */
export function resetAuthReady(): void {
  authReadyPromise = null;
  authReadyResolve = null;
}

/**
 * Wait for auth to be ready with timeout.
 */
export async function waitForAuth(): Promise<boolean> {
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), AUTH_WAIT_TIMEOUT);
  });

  const authPromise = getAuthReadyPromise().then(() => true);

  return Promise.race([authPromise, timeoutPromise]);
}

/**
 * Auth-aware fetch that:
 * 1. Waits for session before making request
 * 2. Retries on 401 after waiting for session refresh
 * 
 * Use this for API calls that require authentication.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Wait for initial auth to be ready
  const authReady = await waitForAuth();

  if (!authReady) {
    console.warn("[authFetch] Auth timeout, proceeding anyway");
  }

  // Ensure credentials are included for cookie-based auth
  const fetchInit: RequestInit = {
    ...init,
    credentials: "include",
  };

  let lastResponse: Response | null = null;

  for (let retryAttempt = 0; retryAttempt <= MAX_5XX_NETWORK_RETRIES; retryAttempt++) {
    if (retryAttempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }

    try {
      for (let attempt = 0; attempt <= MAX_401_RETRIES; attempt++) {
        const response = await fetch(input, fetchInit);
        lastResponse = response;

        if (response.status !== 401) {
          if (response.status >= 500 && response.status < 600 && retryAttempt < MAX_5XX_NETWORK_RETRIES) {
            break; // outer loop will retry
          }
          return response;
        }

        // Got 401 - session might have expired or not ready
        if (attempt < MAX_401_RETRIES) {
          console.log(`[authFetch] Got 401, waiting for auth refresh (attempt ${attempt + 1}/${MAX_401_RETRIES})`);
          resetAuthReady();
          const refreshed = await waitForAuth();
          if (!refreshed) {
            console.warn("[authFetch] Auth refresh timeout");
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      // If we have a 5xx and retries left, outer loop will retry
      if (lastResponse && lastResponse.status >= 500 && lastResponse.status < 600 && retryAttempt < MAX_5XX_NETWORK_RETRIES) {
        continue;
      }
      return lastResponse!;
    } catch (err) {
      if (retryAttempt < MAX_5XX_NETWORK_RETRIES) {
        continue;
      }
      throw err;
    }
  }

  return lastResponse!;
}

/**
 * Check if a response is a 401 that should trigger retry.
 * Useful for custom retry logic.
 */
export function is401Response(response: Response): boolean {
  return response.status === 401;
}
