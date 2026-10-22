/**
 * Session persistence policy for the auth client.
 *
 * Supabase owns the token, but where that token lives is the user's choice:
 * `localStorage` when "Recordarme" is checked (survives closing the browser),
 * `sessionStorage` otherwise (dies with the browser session).
 *
 * Web Storage is not always available (blocked cookies, restricted private
 * contexts, quota). Every access goes through `createSafeStorage`, which keeps
 * the last value in memory for the tab instead of throwing. The password itself
 * is never stored: credential saving stays with the browser password manager.
 */

import { reportAuthDiagnostic } from '../utils/diagnostics';

export const AUTH_STORAGE_KEY = 'produclist-auth';
export const REMEMBER_KEY = 'auth:remember';
export const LAST_EMAIL_KEY = 'auth:last-email';

/** Supabase's pre-deploy key: `sb-<project-ref>-auth-token`. */
const LEGACY_AUTH_KEY = /^sb-.*-auth-token$/;

/** The subset of the Web Storage API Supabase needs. */
export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * An empty string is never a valid stored token. Treating it as absent lets a
 * failed delete be neutralised by overwriting the value (issue #85): a fresh
 * process reads the raw storage and finds nothing usable.
 */
function absentIfEmpty(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}

interface MemoryState {
  values: Map<string, string>;
  /** Keys whose latest write failed: memory wins until a write succeeds. */
  authoritative: Set<string>;
}

/**
 * Fallback state is keyed by the raw Storage object so the login screen and the
 * Supabase client share it without a module-level mutable singleton.
 */
const memories = new WeakMap<Storage, MemoryState>();
/** Shared memory when even reading the `window.localStorage` accessor throws. */
const memoryOnly: MemoryState = { values: new Map(), authoritative: new Set() };

function memoryFor(raw: Storage | null): MemoryState {
  if (!raw) return memoryOnly;
  let state = memories.get(raw);
  if (!state) {
    state = { values: new Map(), authoritative: new Set() };
    memories.set(raw, state);
  }
  return state;
}

/**
 * Reads the storage accessor itself. In browsers that block site data, even
 * `window.localStorage` throws a SecurityError, before any method is called.
 */
function readStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Wraps a raw Storage so a blocked or exhausted storage degrades to an
 * in-memory session instead of crashing the app.
 */
export function createSafeStorage(raw: Storage | null): SafeStorage {
  const memory = memoryFor(raw);

  return {
    getItem(key) {
      if (memory.authoritative.has(key)) return absentIfEmpty(memory.values.get(key) ?? null);
      if (!raw) return absentIfEmpty(memory.values.get(key) ?? null);
      try {
        return absentIfEmpty(raw.getItem(key));
      } catch {
        reportAuthDiagnostic('storage-read-failed', { key });
        return absentIfEmpty(memory.values.get(key) ?? null);
      }
    },
    setItem(key, value) {
      memory.values.set(key, value);
      if (!raw) return;
      try {
        raw.setItem(key, value);
        memory.authoritative.delete(key);
      } catch {
        memory.authoritative.add(key);
        reportAuthDiagnostic('storage-write-failed', { key });
      }
    },
    removeItem(key) {
      memory.values.delete(key);
      if (!raw) return;
      try {
        raw.removeItem(key);
        memory.authoritative.delete(key);
        return;
      } catch {
        // The delete was rejected, so the value may still exist on disk. A
        // fresh launch reads the raw storage directly, so hiding it in memory
        // is not enough: overwrite it with an empty, unusable value.
      }

      try {
        raw.setItem(key, '');
        memory.authoritative.delete(key);
      } catch {
        // Both paths were rejected. The value cannot be revoked from here; the
        // tab stays signed out and the failure is observable (issue #85).
        memory.authoritative.add(key);
        reportAuthDiagnostic('storage-remove-failed', { key });
      }
    },
  };
}

function activeStorage(local: SafeStorage, session: SafeStorage): SafeStorage {
  return local.getItem(REMEMBER_KEY) === '1' ? local : session;
}

/**
 * Storage adapter handed to the Supabase client. It resolves the target on
 * every operation, so a preference change applies to the next token write
 * without rebuilding the client.
 */
export function createAuthStorage(
  local: Storage | null = readStorage('local'),
  session: Storage | null = readStorage('session'),
): AuthStorage {
  const safeLocal = createSafeStorage(local);
  const safeSession = createSafeStorage(session);

  return {
    getItem(key) {
      return activeStorage(safeLocal, safeSession).getItem(key);
    },
    setItem(key, value) {
      const target = activeStorage(safeLocal, safeSession);
      const abandoned = target === safeLocal ? safeSession : safeLocal;
      // Exactly one copy of the token may exist, or a forgotten session would
      // linger in the abandoned storage.
      abandoned.removeItem(key);
      target.setItem(key, value);
    },
    removeItem(key) {
      safeLocal.removeItem(key);
      safeSession.removeItem(key);
    },
  };
}

/**
 * Removes tokens persisted by Supabase before the app used its own storage
 * key. Runs on every launch: deleting an absent key is free and needs no flag.
 */
export function clearLegacyAuthTokens(
  local: Storage | null = readStorage('local'),
  session: Storage | null = readStorage('session'),
): void {
  for (const storage of [local, session]) {
    if (!storage) continue;
    try {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null && LEGACY_AUTH_KEY.test(key)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      // Storage unavailable: nothing to clean, and the safe adapter handles it.
      reportAuthDiagnostic('legacy-token-cleanup-failed');
    }
  }
}

export function isRememberEnabled(
  local: Storage | null = readStorage('local'),
): boolean {
  return createSafeStorage(local).getItem(REMEMBER_KEY) === '1';
}

/**
 * Stores the preference and deletes the session from the storage that is no
 * longer in use, so unchecking "Recordarme" really forgets the token.
 */
export function setRememberPreference(
  remember: boolean,
  local: Storage | null = readStorage('local'),
  session: Storage | null = readStorage('session'),
): void {
  const safeLocal = createSafeStorage(local);
  const safeSession = createSafeStorage(session);
  safeLocal.setItem(REMEMBER_KEY, remember ? '1' : '0');
  const abandoned = remember ? safeSession : safeLocal;
  // Clearing even when it was already inactive removes any stale token left by
  // an earlier preference, so no forgotten session survives on disk.
  abandoned.removeItem(AUTH_STORAGE_KEY);
}

export function readLastEmail(local: Storage | null = readStorage('local')): string {
  return createSafeStorage(local).getItem(LAST_EMAIL_KEY) ?? '';
}

export function writeLastEmail(
  email: string,
  local: Storage | null = readStorage('local'),
): void {
  createSafeStorage(local).setItem(LAST_EMAIL_KEY, email);
}

export function clearLastEmail(local: Storage | null = readStorage('local')): void {
  createSafeStorage(local).removeItem(LAST_EMAIL_KEY);
}
