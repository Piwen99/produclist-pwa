import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, renderHook, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import { createFakeAuth } from '../testing/fakeAuth';
import type { AuthPort, AuthSession } from '../ports';

function Probe() {
  const { status, session, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{session?.email ?? 'none'}</span>
      <button onClick={() => { void signIn('vendedor@example.com', 'secret'); }}>in</button>
      <button onClick={() => { void signOut(); }}>out</button>
    </div>
  );
}

function renderProbe(auth: AuthPort) {
  return render(
    <AuthProvider auth={auth}>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  it('starts loading and resolves a session to authenticated', async () => {
    const auth = createFakeAuth({ initial: { userId: 'user-1', email: 'a@example.com' } });
    renderProbe(auth);

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@example.com');
  });

  it('resolves a missing session to unauthenticated', async () => {
    renderProbe(createFakeAuth());

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('falls back to unauthenticated when getSession throws', async () => {
    const auth: AuthPort = {
      getSession: vi.fn().mockRejectedValue(new Error('transient failure')),
      onAuthStateChange: () => () => {},
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderProbe(auth);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('keeps an authenticated event that arrives before a null getSession resolves', async () => {
    let resolveSession!: (session: AuthSession | null) => void;
    let emitAuthChange: ((session: AuthSession | null) => void) | undefined;
    const auth: AuthPort = {
      getSession: () =>
        new Promise<AuthSession | null>((resolve) => {
          resolveSession = resolve;
        }),
      onAuthStateChange: (listener) => {
        emitAuthChange = listener;
        return () => {};
      },
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderProbe(auth);

    act(() => {
      emitAuthChange?.({ userId: 'user-race', email: 'race@example.com' });
    });
    expect(screen.getByTestId('status')).toHaveTextContent(/^authenticated$/);

    await act(async () => {
      resolveSession(null);
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent(/^authenticated$/);
  });

  it('keeps an authenticated event that arrives before getSession rejects', async () => {
    let rejectSession!: (reason?: unknown) => void;
    let emitAuthChange: ((session: AuthSession | null) => void) | undefined;
    const auth: AuthPort = {
      getSession: () =>
        new Promise<AuthSession | null>((_resolve, reject) => {
          rejectSession = reject;
        }),
      onAuthStateChange: (listener) => {
        emitAuthChange = listener;
        return () => {};
      },
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderProbe(auth);

    act(() => {
      emitAuthChange?.({ userId: 'user-race', email: 'race@example.com' });
    });
    expect(screen.getByTestId('status')).toHaveTextContent(/^authenticated$/);

    await act(async () => {
      rejectSession(new Error('transient failure'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent(/^authenticated$/);
  });

  it('maps emitted sessions to authenticated and unauthenticated', async () => {
    const auth = createFakeAuth();
    renderProbe(auth);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    act(() => auth.emit({ userId: 'user-9', email: 'vendedor9@example.com' }));
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');

    act(() => auth.emit(null));
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  it('authenticates after a successful sign in', async () => {
    const user = userEvent.setup();
    renderProbe(createFakeAuth());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    await user.click(screen.getByRole('button', { name: 'in' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
  });

  it('propagates sign-in errors to the caller', async () => {
    const auth = createFakeAuth();
    vi.spyOn(auth, 'signIn').mockRejectedValue(new Error('Correo o contraseña incorrectos.'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider auth={auth}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await expect(result.current.signIn('a@example.com', 'bad')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    );
  });

  it('returns to unauthenticated after sign out', async () => {
    const user = userEvent.setup();
    const auth = createFakeAuth({ initial: { userId: 'user-1', email: 'a@example.com' } });
    renderProbe(auth);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'out' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('unsubscribes from auth state changes on unmount', () => {
    const unsubscribe = vi.fn();
    const auth: AuthPort = {
      getSession: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn(() => unsubscribe),
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    const { unmount } = renderProbe(auth);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('throws when useAuth is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
    spy.mockRestore();
  });
});
