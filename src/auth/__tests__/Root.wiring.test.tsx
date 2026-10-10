import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import Root from '../../Root';
import type { AuthPort, AuthSession } from '../ports';

const clientFactory = vi.hoisted(() => vi.fn(() => ({ marker: 'client' })));
const authFactory = vi.hoisted(() => vi.fn());
const reposFactory = vi.hoisted(() => vi.fn(() => ({ marker: 'repos' })));
const e2eAuthFactory = vi.hoisted(() => vi.fn());
const e2eReposFactory = vi.hoisted(() => vi.fn(() => ({ marker: 'e2e-repos' })));

vi.mock('../../data/supabase/client', () => ({
  readSupabaseConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'anon' }),
  createSupabaseClient: clientFactory,
}));
vi.mock('../supabaseAuth', () => ({ createSupabaseAuth: authFactory }));
vi.mock('../../data/supabase/repositories', () => ({
  createSupabaseRepositories: reposFactory,
}));
vi.mock('../testing/fakeAuth', () => ({ createE2eAuth: e2eAuthFactory }));
vi.mock('../../data/testing/stub', () => ({
  createE2eRepositories: e2eReposFactory,
}));
vi.mock('../../App', () => ({ default: () => 'AuthenticatedApp' }));
vi.mock('../../data/DataProvider', () => ({
  DataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

let emit: (session: AuthSession | null) => void = () => {};

function fakeAuthPort(): AuthPort {
  return {
    getSession: () => Promise.resolve(null),
    onAuthStateChange: (listener) => {
      emit = listener;
      return () => {};
    },
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
  };
}

describe('Root Supabase wiring', () => {
  beforeEach(() => {
    clientFactory.mockClear();
    reposFactory.mockClear();
    authFactory.mockClear();
    e2eAuthFactory.mockClear();
    e2eReposFactory.mockClear();
    authFactory.mockImplementation(() => fakeAuthPort());
    e2eAuthFactory.mockImplementation(() => fakeAuthPort());
    emit = () => {};
    vi.stubEnv('VITE_E2E', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates one client and repository set and does not recreate them on repeated auth events', async () => {
    render(<Root />);

    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await screen.findByText('AuthenticatedApp');

    expect(clientFactory).toHaveBeenCalledTimes(1);
    expect(reposFactory).toHaveBeenCalledTimes(1);

    // A token refresh hands the gate a new session object with the same user id.
    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });

    expect(clientFactory).toHaveBeenCalledTimes(1);
    expect(reposFactory).toHaveBeenCalledTimes(1);
  });

  it('rebuilds repositories when the authenticated user id changes', async () => {
    render(<Root />);

    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await screen.findByText('AuthenticatedApp');

    await act(async () => {
      emit({ userId: 'user-2', email: 'b@b.cl' });
    });

    expect(reposFactory).toHaveBeenCalledTimes(2);
    expect(clientFactory).toHaveBeenCalledTimes(1);
  });

  it('wires the e2e repositories with the authenticated user id', async () => {
    vi.stubEnv('VITE_E2E', '1');
    render(<Root />);

    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await screen.findByText('AuthenticatedApp');

    expect(e2eReposFactory).toHaveBeenCalledTimes(1);
    expect(e2eReposFactory).toHaveBeenCalledWith({ userId: 'user-1', isAdmin: false });
    expect(reposFactory).not.toHaveBeenCalled();
  });

  it('shows the login screen for an authenticated session with an empty user id', async () => {
    render(<Root />);

    await act(async () => {
      emit({ userId: '', email: null });
    });

    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
