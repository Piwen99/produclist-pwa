import type { AuthPort, AuthSession } from '../ports';

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

export type FakeAuth = AuthPort & {
  emit(session: AuthSession | null): void;
};

export function createFakeAuth(options: { initial?: AuthSession | null } = {}): FakeAuth {
  let session = options.initial ?? null;
  const listeners = new Set<(session: AuthSession | null) => void>();

  function emit(next: AuthSession | null): void {
    session = next;
    listeners.forEach((listener) => listener(next));
  }

  return {
    getSession() {
      return Promise.resolve(session);
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    signIn(email, password) {
      if (!email || !password) {
        return Promise.reject(new Error(INVALID_CREDENTIALS_MESSAGE));
      }
      emit({ userId: email, email });
      return Promise.resolve();
    },

    signOut() {
      emit(null);
      return Promise.resolve();
    },

    emit,
  };
}

const E2E_SESSION: AuthSession = { userId: 'e2e-user', email: 'e2e@example.com' };
const E2E_AUTH_STORAGE_KEY = 'e2e:auth';

export function createE2eAuth(): AuthPort {
  const startsOff = localStorage.getItem(E2E_AUTH_STORAGE_KEY) === 'off';
  let session: AuthSession | null = startsOff ? null : E2E_SESSION;
  const listeners = new Set<(session: AuthSession | null) => void>();

  function emit(next: AuthSession | null): void {
    session = next;
    listeners.forEach((listener) => listener(next));
  }

  return {
    getSession() {
      return Promise.resolve(session);
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    signIn(email, password) {
      if (!email || !password) {
        return Promise.reject(new Error(INVALID_CREDENTIALS_MESSAGE));
      }
      emit(E2E_SESSION);
      return Promise.resolve();
    },

    signOut() {
      emit(null);
      return Promise.resolve();
    },
  };
}
