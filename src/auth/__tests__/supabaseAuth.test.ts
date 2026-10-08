import { describe, it, expect, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAuth, INVALID_CREDENTIALS_MESSAGE } from '../supabaseAuth';

type AuthChangeHandler = (event: string, session: Session | null) => void;

function makeSession(userId = 'user-1', email: string | null = 'admin@example.com'): Session {
  return { user: { id: userId, email } } as unknown as Session;
}

function makeStub() {
  const handlers: AuthChangeHandler[] = [];
  const unsubscribe = vi.fn();

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null as Session | null }, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: { user: null, session: null },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn((handler: AuthChangeHandler) => {
      handlers.push(handler);
      return { data: { subscription: { unsubscribe } } };
    }),
  };

  const client = { auth } as unknown as SupabaseClient;
  return { client, auth, handlers, unsubscribe };
}

describe('createSupabaseAuth', () => {
  describe('getSession', () => {
    it('maps the Supabase session to an AuthSession', async () => {
      const { client, auth } = makeStub();
      auth.getSession.mockResolvedValueOnce({
        data: { session: makeSession('user-9', 'vendedor1@example.com') },
        error: null,
      });

      const session = await createSupabaseAuth(client).getSession();

      expect(session).toEqual({ userId: 'user-9', email: 'vendedor1@example.com' });
    });

    it('returns null when there is no session', async () => {
      const { client } = makeStub();
      expect(await createSupabaseAuth(client).getSession()).toBeNull();
    });

    it('maps a missing email to null', async () => {
      const { client, auth } = makeStub();
      auth.getSession.mockResolvedValueOnce({
        data: { session: makeSession('user-2', null) },
        error: null,
      });

      expect(await createSupabaseAuth(client).getSession()).toEqual({
        userId: 'user-2',
        email: null,
      });
    });

    it('propagates a Supabase error', async () => {
      const { client, auth } = makeStub();
      const error = new Error('boom');
      auth.getSession.mockResolvedValueOnce({ data: { session: null }, error });

      await expect(createSupabaseAuth(client).getSession()).rejects.toBe(error);
    });
  });

  describe('onAuthStateChange', () => {
    it('delivers mapped sessions to the listener', () => {
      const { client, handlers } = makeStub();
      const listener = vi.fn();

      createSupabaseAuth(client).onAuthStateChange(listener);
      handlers[0]('SIGNED_IN', makeSession('user-3', 'vendedor3@example.com'));

      expect(listener).toHaveBeenCalledWith({
        userId: 'user-3',
        email: 'vendedor3@example.com',
      });
    });

    it('handles the INITIAL_SESSION case named by the design', () => {
      const { client, handlers } = makeStub();
      const listener = vi.fn();

      createSupabaseAuth(client).onAuthStateChange(listener);
      handlers[0]('INITIAL_SESSION', makeSession('user-4', null));

      expect(listener).toHaveBeenCalledWith({ userId: 'user-4', email: null });
    });

    it('delivers null on SIGNED_OUT', () => {
      const { client, handlers } = makeStub();
      const listener = vi.fn();

      createSupabaseAuth(client).onAuthStateChange(listener);
      handlers[0]('SIGNED_OUT', null);

      expect(listener).toHaveBeenCalledWith(null);
    });

    it('returns an unsubscribe function that tears the subscription down', () => {
      const { client, unsubscribe } = makeStub();

      const stop = createSupabaseAuth(client).onAuthStateChange(vi.fn());
      stop();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('signIn', () => {
    it('resolves when credentials are accepted', async () => {
      const { client, auth } = makeStub();

      await expect(
        createSupabaseAuth(client).signIn('admin@example.com', 'secret'),
      ).resolves.toBeUndefined();
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'secret',
      });
    });

    it('maps an invalid_credentials error to a user-safe Spanish message', async () => {
      const { client, auth } = makeStub();
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });

      await expect(createSupabaseAuth(client).signIn('x@y.com', 'bad')).rejects.toThrow(
        INVALID_CREDENTIALS_MESSAGE,
      );
    });

    it('maps a message-only invalid login credentials error to the safe message', async () => {
      const { client, auth } = makeStub();
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(createSupabaseAuth(client).signIn('x@y.com', 'bad')).rejects.toThrow(
        INVALID_CREDENTIALS_MESSAGE,
      );
    });

    it('surfaces other errors with their own message', async () => {
      const { client, auth } = makeStub();
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' },
      });

      await expect(createSupabaseAuth(client).signIn('x@y.com', 'bad')).rejects.toThrow(
        'Email rate limit exceeded',
      );
    });
  });

  describe('signOut', () => {
    it('resolves on success', async () => {
      const { client, auth } = makeStub();
      await expect(createSupabaseAuth(client).signOut()).resolves.toBeUndefined();
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('propagates a sign-out error', async () => {
      const { client, auth } = makeStub();
      const error = new Error('cannot sign out');
      auth.signOut.mockResolvedValueOnce({ error });

      await expect(createSupabaseAuth(client).signOut()).rejects.toBe(error);
    });
  });
});
