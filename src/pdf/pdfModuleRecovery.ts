const RECOVERY_GUARD_KEY = 'produclist:pdf-chunk-recovery';

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk \S+ failed/i,
];

/** Extracts a human-readable message from an unknown thrown value. */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint' ||
    typeof error === 'symbol'
  ) {
    return String(error);
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

/**
 * Detects the browser's chunk-load failure signatures that appear when a
 * hashed asset cannot be fetched (stale service-worker precache or cached old
 * `index.html` after a deploy). Recognizes Vite/Webpack error names as well as
 * the underlying messages, case-insensitively.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if ((error as { name?: unknown }).name === 'ChunkLoadError') return true;

  const message = toErrorMessage(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Reads the per-session guard that bounds recovery attempts to once. */
export function hasAttemptedRecovery(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_GUARD_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Records that a recovery attempt was already made this session. Returns
 * `true` when the guard persisted and `false` when storage is unavailable.
 * On `false` the caller MUST NOT auto-reload, otherwise a persistent failure
 * (private mode, blocked cookies) would become an unbounded reload loop.
 */
export function markRecoveryAttempted(): boolean {
  try {
    window.sessionStorage.setItem(RECOVERY_GUARD_KEY, '1');
    return true;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the guard
    // simply degrades to "not attempted".
    return false;
  }
}

/** Clears the recovery guard after a successful load. */
export function clearRecoveryAttempt(): void {
  try {
    window.sessionStorage.removeItem(RECOVERY_GUARD_KEY);
  } catch {
    // See markRecoveryAttempted: storage failures are non-fatal.
  }
}

/**
 * Best-effort removal of stale offline assets: unregisters every service
 * worker and deletes every cache. Both steps are independent and never throw,
 * so a failure in one does not prevent the other.
 */
export async function clearStaleAssets(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Service worker API may be blocked; ignore and continue.
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // CacheStorage may be unavailable; ignore.
  }
}

/** Reloads the current page so the browser fetches a fresh HTML/asset graph. */
export function reloadPage(): void {
  window.location.reload();
}
