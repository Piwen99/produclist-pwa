/**
 * Session persistence policy for the auth client.
 *
 * Supabase owns the token, but where that token lives is the user's choice:
 * `localStorage` when "Recordarme" is checked (survives closing the browser),
 * `sessionStorage` otherwise (dies with the browser session).
 *
 * The password itself is never stored. Credential saving stays delegated to the
 * browser password manager through the `autoComplete` attributes of the form.
 */

export const AUTH_STORAGE_KEY = 'produclist-auth';
export const REMEMBER_KEY = 'auth:remember';
export const LAST_EMAIL_KEY = 'auth:last-email';

/** The subset of the Web Storage API Supabase needs. */
export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function activeStorage(local: Storage, session: Storage): Storage {
  return local.getItem(REMEMBER_KEY) === '1' ? local : session;
}

/**
 * Storage adapter handed to the Supabase client. It resolves the target on
 * every operation, so a preference change applies to the next token write
 * without rebuilding the client.
 */
export function createAuthStorage(
  local: Storage = window.localStorage,
  session: Storage = window.sessionStorage,
): AuthStorage {
  return {
    getItem(key) {
      return activeStorage(local, session).getItem(key);
    },
    setItem(key, value) {
      const target = activeStorage(local, session);
      const abandoned = target === local ? session : local;
      // Exactly one copy of the token may exist, or a forgotten session would
      // linger in the abandoned storage.
      abandoned.removeItem(key);
      target.setItem(key, value);
    },
    removeItem(key) {
      local.removeItem(key);
      session.removeItem(key);
    },
  };
}

export function isRememberEnabled(local: Storage = window.localStorage): boolean {
  return local.getItem(REMEMBER_KEY) === '1';
}

/**
 * Stores the preference and deletes the session from the storage that is no
 * longer in use, so unchecking "Recordarme" really forgets the token.
 */
export function setRememberPreference(
  remember: boolean,
  local: Storage = window.localStorage,
  session: Storage = window.sessionStorage,
): void {
  local.setItem(REMEMBER_KEY, remember ? '1' : '0');
  const abandoned = remember ? session : local;
  // Clearing even when it was already inactive removes any stale token left by
  // an earlier preference, so no forgotten session survives on disk.
  abandoned.removeItem(AUTH_STORAGE_KEY);
}

export function readLastEmail(local: Storage = window.localStorage): string {
  return local.getItem(LAST_EMAIL_KEY) ?? '';
}

export function writeLastEmail(email: string, local: Storage = window.localStorage): void {
  local.setItem(LAST_EMAIL_KEY, email);
}

export function clearLastEmail(local: Storage = window.localStorage): void {
  local.removeItem(LAST_EMAIL_KEY);
}
