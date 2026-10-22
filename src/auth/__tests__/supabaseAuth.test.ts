import { describe, it, expect, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseAuth,
  CURRENT_PASSWORD_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_UPDATE_MESSAGE,
  PASSWORD_UPDATE_TIMEOUT_MS,
  REAUTHENTICATION_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
} from '../supabaseAuth';

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
    updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
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

  describe('changePassword', () => {
    function stubWithSession() {
      return makeStub();
    }

    it('resolves when the provider accepts the update without validating current_password (rollout assumption)', async () => {
      const { client, auth } = stubWithSession();

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).resolves.toBeUndefined();

      expect(auth.updateUser).toHaveBeenCalledWith({
        current_password: 'current-secret',
        password: 'new-secret-1',
      });
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
      expect(auth.getSession).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a message-only current-password error',
        { message: 'Current password is incorrect' },
        CURRENT_PASSWORD_MESSAGE,
      ],
      [
        'a message-only reauthentication error',
        { message: 'Reauthentication required' },
        REAUTHENTICATION_MESSAGE,
      ],
    ])('maps %s without a provider code (issue #89)', async (_label, error, expected) => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(expected);
    });

    it('prefers the current-password message when both signals overlap, without signing out (issue #89)', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: {
          message: 'Current password is incorrect. Reauthentication required.',
        },
      });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(CURRENT_PASSWORD_MESSAGE);
      // A wrong password is recoverable: the session must survive.
      expect(auth.signOut).not.toHaveBeenCalled();
    });

    it('forwards empty values; validation belongs to the dialog (issue #89)', async () => {
      const { client, auth } = stubWithSession();

      await expect(
        createSupabaseAuth(client).changePassword('', ''),
      ).resolves.toBeUndefined();
      expect(auth.updateUser).toHaveBeenCalledWith({ current_password: '', password: '' });
    });

    it('maps a current password mismatch to a safe message', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'current_password_mismatch',
          message: 'Current password is incorrect',
        },
      });

      await expect(
        createSupabaseAuth(client).changePassword('wrong-secret', 'new-secret-1'),
      ).rejects.toThrow(CURRENT_PASSWORD_MESSAGE);
    });

    it('maps a reauthentication requirement to a re-login message', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'reauthentication_needed',
          message: 'Reauthentication required',
        },
      });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(REAUTHENTICATION_MESSAGE);
      // A retry with the same stale session cannot work: the gate must show
      // the login screen (issue #87).
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['session_expired', { code: 'session_expired', message: 'Session expired' }],
      ['session_not_found', { code: 'session_not_found', message: 'Session not found' }],
    ])('signs out and asks to re-login on %s (issue #87)', async (_label, error) => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(REAUTHENTICATION_MESSAGE);
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('signs out when the client throws AuthSessionMissingError (issue #87)', async () => {
      const { client, auth } = stubWithSession();
      const missing = new Error('Auth session missing!');
      missing.name = 'AuthSessionMissingError';
      auth.updateUser.mockRejectedValueOnce(missing);

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(REAUTHENTICATION_MESSAGE);
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('keeps the re-login message when the sign-out itself fails (issue #87)', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { code: 'session_expired', message: 'Session expired' },
      });
      auth.signOut.mockRejectedValueOnce(new Error('network down'));

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(REAUTHENTICATION_MESSAGE);
    });

    it('maps a weak password to a safe message', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { code: 'weak_password', message: 'Password should be at least 6 characters.' },
      });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'weak'),
      ).rejects.toThrow(WEAK_PASSWORD_MESSAGE);
    });

    it('maps a repeated password to a safe message', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'same_password',
          message: 'New password should be different from the old password.',
        },
      });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'current-secret'),
      ).rejects.toThrow(SAME_PASSWORD_MESSAGE);
    });

    it('never surfaces a raw provider message for an unknown failure', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { code: 'unexpected_failure', message: 'Internal server error' },
      });

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(PASSWORD_UPDATE_MESSAGE);
    });

    it('maps a thrown password update to a safe message', async () => {
      const { client, auth } = stubWithSession();
      auth.updateUser.mockRejectedValueOnce(new Error('Network connection lost'));

      await expect(
        createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
      ).rejects.toThrow(PASSWORD_UPDATE_MESSAGE);
    });

    it('reports the transport cause once, without leaking it to the user (issue #86)', async () => {
      const { client, auth } = stubWithSession();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      auth.updateUser.mockRejectedValueOnce(
        new TypeError('Failed to fetch https://project.supabase.co/auth/v1/user'),
      );

      try {
        await expect(
          createSupabaseAuth(client).changePassword('current-secret', 'new-secret-1'),
        ).rejects.toThrow(PASSWORD_UPDATE_MESSAGE);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][1]).toBe('auth-transport-failed');
        expect(JSON.stringify(warn.mock.calls[0])).not.toContain('supabase.co');
      } finally {
        warn.mockRestore();
      }
    });

    it('unblocks a hung password change after the timeout (issue #88)', async () => {
      const { client, auth } = stubWithSession();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      auth.updateUser.mockReturnValue(new Promise(() => {}));
      vi.useFakeTimers();

      try {
        const settled = createSupabaseAuth(client)
          .changePassword('current-secret', 'new-secret-1')
          .then(
            () => 'resolved',
            (error: Error) => error.message,
          );

        await vi.advanceTimersByTimeAsync(PASSWORD_UPDATE_TIMEOUT_MS);

        await expect(settled).resolves.toBe(PASSWORD_UPDATE_MESSAGE);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][1]).toBe('auth-transport-failed');
        expect(warn.mock.calls[0][2]).toMatchObject({ reason: 'TimeoutError' });
      } finally {
        vi.useRealTimers();
        warn.mockRestore();
      }
    });

    it('ignores a late success after the timeout (issue #88)', async () => {
      const { client, auth } = stubWithSession();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let resolveLate: ((value: unknown) => void) | undefined;
      auth.updateUser.mockReturnValue(
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
      );
      vi.useFakeTimers();

      try {
        const settled = createSupabaseAuth(client)
          .changePassword('current-secret', 'new-secret-1')
          .then(
            () => 'resolved',
            (error: Error) => error.message,
          );

        await vi.advanceTimersByTimeAsync(PASSWORD_UPDATE_TIMEOUT_MS);
        // The provider answers after the dialog gave up: the success path must
        // not run, and the user must not see a second outcome.
        resolveLate?.({ data: { user: null }, error: null });
        await vi.advanceTimersByTimeAsync(0);

        await expect(settled).resolves.toBe(PASSWORD_UPDATE_MESSAGE);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
        warn.mockRestore();
      }
    });
  });
});
