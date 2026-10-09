import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import Root from '../../Root';
import type { AuthPort, AuthSession } from '../ports';

const clientFactory = vi.hoisted(() => vi.fn(() => ({ marker: 'client' })));
const authFactory = vi.hoisted(() => vi.fn());
const reposFactory = vi.hoisted(() => vi.fn(() => ({ marker: 'repos' })));

vi.mock('../../data/supabase/client', () => ({
  readSupabaseConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'anon' }),
  createSupabaseClient: clientFactory,
}));
vi.mock('../supabaseAuth', () => ({ createSupabaseAuth: authFactory }));
vi.mock('../../data/supabase/repositories', () => ({
  createSupabaseRepositories: reposFactory,
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
    authFactory.mockImplementation(() => fakeAuthPort());
    vi.stubEnv('VITE_E2E', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a single Supabase client shared by auth and repositories', async () => {
    render(<Root />);

    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await screen.findByText('AuthenticatedApp');

    expect(clientFactory).toHaveBeenCalledTimes(1);
    expect(reposFactory).toHaveBeenCalledTimes(1);
  });

  it('does not recreate the client or repositories on repeated auth events', async () => {
    render(<Root />);

    await act(async () => {
      emit({ userId: 'user-1', email: 'a@b.cl' });
    });
    await screen.findByText('AuthenticatedApp');

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
});
