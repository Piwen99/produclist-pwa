import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  REMEMBER_KEY,
  LAST_EMAIL_KEY,
  clearLastEmail,
  createAuthStorage,
  isRememberEnabled,
  readLastEmail,
  setRememberPreference,
  writeLastEmail,
} from '../authStorage';

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
  });
});
