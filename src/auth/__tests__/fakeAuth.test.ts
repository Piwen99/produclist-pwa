import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createE2eAuth, createFakeAuth } from '../testing/fakeAuth';

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

describe('createFakeAuth', () => {
  it('starts unauthenticated by default', async () => {
    const auth = createFakeAuth();
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it('starts with the provided initial session', async () => {
    const initial = { userId: 'user-1', email: 'vendedor1@example.com' };
    const auth = createFakeAuth({ initial });
    await expect(auth.getSession()).resolves.toEqual(initial);
  });

  it('registers listeners without re-emitting on subscribe', () => {
    const auth = createFakeAuth();
    const listener = vi.fn();

    const unsubscribe = auth.onAuthStateChange(listener);

    expect(listener).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });

  it('notifies listeners on emit and stops after unsubscribe', () => {
    const auth = createFakeAuth();
    const listener = vi.fn();
    const stop = auth.onAuthStateChange(listener);

    auth.emit({ userId: 'user-2', email: 'vendedor2@example.com' });
    expect(listener).toHaveBeenCalledWith({
      userId: 'user-2',
      email: 'vendedor2@example.com',
    });

    stop();
    auth.emit(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('signs in with any non-empty credentials and emits the session', async () => {
    const auth = createFakeAuth();
    const listener = vi.fn();
    auth.onAuthStateChange(listener);

    await auth.signIn('vendedor@example.com', 'secret');

    expect(listener).toHaveBeenCalledWith({
      userId: 'vendedor@example.com',
      email: 'vendedor@example.com',
    });
    await expect(auth.getSession()).resolves.toEqual({
      userId: 'vendedor@example.com',
      email: 'vendedor@example.com',
    });
  });

  it('rejects empty email or password with the generic message', async () => {
    const auth = createFakeAuth();
    await expect(auth.signIn('', 'secret')).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    await expect(auth.signIn('vendedor@example.com', '')).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
  });

  it('signs out by emitting null', async () => {
    const auth = createFakeAuth({ initial: { userId: 'user-1', email: 'a@example.com' } });
    const listener = vi.fn();
    auth.onAuthStateChange(listener);

    await auth.signOut();

    expect(listener).toHaveBeenCalledWith(null);
    await expect(auth.getSession()).resolves.toBeNull();
  });
});

describe('createE2eAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts authenticated with a fixed session by default', async () => {
    const auth = createE2eAuth();
    await expect(auth.getSession()).resolves.toEqual({
      userId: 'e2e-user',
      email: 'e2e@example.com',
    });
  });

  it('starts unauthenticated when the e2e auth flag is off', async () => {
    localStorage.setItem('e2e:auth', 'off');
    const auth = createE2eAuth();
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it('signs in with any non-empty credentials and emits', async () => {
    localStorage.setItem('e2e:auth', 'off');
    const auth = createE2eAuth();
    const listener = vi.fn();
    auth.onAuthStateChange(listener);

    await auth.signIn('e2e@example.com', 'secret');

    expect(listener).toHaveBeenCalledWith({
      userId: 'e2e-user',
      email: 'e2e@example.com',
    });
    await expect(auth.getSession()).resolves.not.toBeNull();
  });

  it('signs out and emits null', async () => {
    const auth = createE2eAuth();
    const listener = vi.fn();
    auth.onAuthStateChange(listener);

    await auth.signOut();

    expect(listener).toHaveBeenCalledWith(null);
    await expect(auth.getSession()).resolves.toBeNull();
  });
});
