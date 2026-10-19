import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  REMEMBER_KEY,
  LAST_EMAIL_KEY,
  clearLastEmail,
  clearLegacyAuthTokens,
  createAuthStorage,
  createSafeStorage,
  isRememberEnabled,
  readLastEmail,
  setRememberPreference,
  writeLastEmail,
} from '../authStorage';

interface StubStorage extends Storage {
  failGet?: boolean;
  failSet?: boolean;
  failRemove?: boolean;
}

function createStubStorage(seed: Record<string, string> = {}): StubStorage {
  const data = new Map<string, string>(Object.entries(seed));
  const stub: StubStorage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    getItem(key: string) {
      if (stub.failGet) throw new Error('storage blocked');
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (stub.failSet) throw new Error('storage blocked');
      data.set(key, value);
    },
    removeItem(key: string) {
      if (stub.failRemove) throw new Error('storage blocked');
      data.delete(key);
    },
  };
  return stub;
}

function createThrowingStorage(): Storage {
  const blocked = () => {
    throw new Error('storage blocked');
  };
  return {
    length: 0,
    clear: blocked,
    getItem: blocked,
    key: blocked,
    removeItem: blocked,
    setItem: blocked,
  } as Storage;
}

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('createAuthStorage', () => {
    it('reads and writes the session in sessionStorage by default', () => {
      const storage = createAuthStorage();

      storage.setItem(AUTH_STORAGE_KEY, 'token');

      expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBe('token');
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(storage.getItem(AUTH_STORAGE_KEY)).toBe('token');
    });

    it('reads and writes the session in localStorage when the user chose to be remembered', () => {
      localStorage.setItem(REMEMBER_KEY, '1');
      const storage = createAuthStorage();

      storage.setItem(AUTH_STORAGE_KEY, 'token');

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('token');
      expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(storage.getItem(AUTH_STORAGE_KEY)).toBe('token');
    });

    it('keeps a single copy of the token when the active storage changes', () => {
      const storage = createAuthStorage();
      storage.setItem(AUTH_STORAGE_KEY, 'first');

      localStorage.setItem(REMEMBER_KEY, '1');
      storage.setItem(AUTH_STORAGE_KEY, 'second');

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('second');
      expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('removes the token from both storages', () => {
      localStorage.setItem(AUTH_STORAGE_KEY, 'local');
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'session');
      const storage = createAuthStorage();

      storage.removeItem(AUTH_STORAGE_KEY);

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('ignores a token left in the storage that is no longer active', () => {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(AUTH_STORAGE_KEY, 'remembered');
      localStorage.setItem(REMEMBER_KEY, '0');

      expect(createAuthStorage().getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
  });

  describe('remember preference', () => {
    it('is disabled on a device that never chose', () => {
      expect(isRememberEnabled()).toBe(false);
    });

    it('reports the stored choice', () => {
      localStorage.setItem(REMEMBER_KEY, '1');
      expect(isRememberEnabled()).toBe(true);

      localStorage.setItem(REMEMBER_KEY, '0');
      expect(isRememberEnabled()).toBe(false);
    });

    it('wipes the session from the abandoned storage when enabling', () => {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'session-token');

      setRememberPreference(true);

      expect(localStorage.getItem(REMEMBER_KEY)).toBe('1');
      expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('wipes the session from the abandoned storage when disabling', () => {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(AUTH_STORAGE_KEY, 'local-token');

      setRememberPreference(false);

      expect(localStorage.getItem(REMEMBER_KEY)).toBe('0');
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
  });

  describe('last email', () => {
    it('returns an empty value when nothing was remembered', () => {
      expect(readLastEmail()).toBe('');
    });

    it('round-trips the remembered email', () => {
      writeLastEmail('vendedor@example.com');

      expect(localStorage.getItem(LAST_EMAIL_KEY)).toBe('vendedor@example.com');
      expect(readLastEmail()).toBe('vendedor@example.com');
    });

    it('clears the remembered email', () => {
      writeLastEmail('vendedor@example.com');

      clearLastEmail();

      expect(localStorage.getItem(LAST_EMAIL_KEY)).toBeNull();
      expect(readLastEmail()).toBe('');
    });

    it('survives unavailable storage', () => {
      const blocked = createThrowingStorage();

      expect(() => writeLastEmail('vendedor@example.com', blocked)).not.toThrow();
      expect(() => clearLastEmail(blocked)).not.toThrow();
      expect(readLastEmail(blocked)).toBe('');
    });
  });

  describe('createSafeStorage', () => {
    it('reads and writes the real storage while it is healthy', () => {
      const raw = createStubStorage();
      const safe = createSafeStorage(raw);

      safe.setItem('token', 'value');

      expect(raw.getItem('token')).toBe('value');
      expect(safe.getItem('token')).toBe('value');
    });

    it('keeps a failed write in memory for the session', () => {
      const raw = createStubStorage();
      raw.failSet = true;
      const safe = createSafeStorage(raw);

      safe.setItem('token', 'value');

      expect(safe.getItem('token')).toBe('value');
      expect(raw.getItem('token')).toBeNull();
    });

    it('returns to the real storage after a later write succeeds', () => {
      const raw = createStubStorage();
      const safe = createSafeStorage(raw);
      raw.failSet = true;
      safe.setItem('token', 'first');
      raw.failSet = false;

      safe.setItem('token', 'second');

      expect(raw.getItem('token')).toBe('second');
      expect(safe.getItem('token')).toBe('second');
    });

    it('falls back to memory when a read is blocked after a successful write', () => {
      const raw = createStubStorage();
      const safe = createSafeStorage(raw);
      safe.setItem('token', 'value');
      raw.failGet = true;

      expect(safe.getItem('token')).toBe('value');
    });

    it('hides a value that could not be removed from the real storage', () => {
      const raw = createStubStorage({ token: 'value' });
      const safe = createSafeStorage(raw);
      raw.failRemove = true;

      safe.removeItem('token');

      expect(safe.getItem('token')).toBeNull();
      expect(raw.getItem('token')).toBe('value');
    });

    it('shares the fallback across wrappers of the same storage', () => {
      const raw = createStubStorage();
      raw.failSet = true;
      createSafeStorage(raw).setItem('token', 'value');

      expect(createSafeStorage(raw).getItem('token')).toBe('value');
    });

    it('returns null instead of throwing on a blocked read with no fallback', () => {
      const raw = createThrowingStorage();

      expect(createSafeStorage(raw).getItem('token')).toBeNull();
    });
  });

  describe('clearLegacyAuthTokens', () => {
    it('removes legacy Supabase auth keys from both storages', () => {
      localStorage.setItem('sb-legacy-auth-token', 'old');
      localStorage.setItem('produclist-auth', 'current');
      localStorage.setItem('auth:remember', '1');
      sessionStorage.setItem('sb-legacy-auth-token', 'old');
      sessionStorage.setItem('sb-legacy-auth-token-code-verifier', 'verifier');

      clearLegacyAuthTokens();

      expect(localStorage.getItem('sb-legacy-auth-token')).toBeNull();
      expect(sessionStorage.getItem('sb-legacy-auth-token')).toBeNull();
      expect(localStorage.getItem('produclist-auth')).toBe('current');
      expect(localStorage.getItem('auth:remember')).toBe('1');
      expect(sessionStorage.getItem('sb-legacy-auth-token-code-verifier')).toBe('verifier');
    });

    it('is idempotent', () => {
      localStorage.setItem('sb-legacy-auth-token', 'old');

      clearLegacyAuthTokens();
      expect(() => clearLegacyAuthTokens()).not.toThrow();

      expect(localStorage.getItem('sb-legacy-auth-token')).toBeNull();
    });

    it('never throws when storage is unavailable', () => {
      const blocked = createThrowingStorage();

      expect(() => clearLegacyAuthTokens(blocked, blocked)).not.toThrow();
    });
  });

  describe('degraded storage', () => {
    it('routes the token to memory when both storages throw', () => {
      const storage = createAuthStorage(createThrowingStorage(), createThrowingStorage());

      expect(() => storage.setItem(AUTH_STORAGE_KEY, 'token')).not.toThrow();
      expect(storage.getItem(AUTH_STORAGE_KEY)).toBe('token');
      expect(() => storage.removeItem(AUTH_STORAGE_KEY)).not.toThrow();
      expect(storage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('stores the remember preference without throwing', () => {
      expect(() =>
        setRememberPreference(true, createThrowingStorage(), createThrowingStorage()),
      ).not.toThrow();
    });
  });
});
