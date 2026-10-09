import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Root from '../../Root';
import { e2eBypassEnabled } from '../e2eBypass';

vi.mock('../../App', () => ({ default: () => 'AuthenticatedApp' }));

describe('e2eBypassEnabled', () => {
  // Vite statically replaces `import.meta.env.PROD`/`VITE_*` at build time, so a
  // unit test cannot exercise a real production bundle. Exercising the pure
  // predicate is the honest check of the production guard.
  it('is true only for VITE_E2E=1 outside production', () => {
    expect(e2eBypassEnabled({ VITE_E2E: '1' })).toBe(true);
    expect(e2eBypassEnabled({ VITE_E2E: '1', PROD: false })).toBe(true);
    expect(e2eBypassEnabled({ VITE_E2E: '0', PROD: false })).toBe(false);
    expect(e2eBypassEnabled({})).toBe(false);
    expect(e2eBypassEnabled({ VITE_E2E: '1', PROD: true })).toBe(false);
  });
});

describe('Root auth gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('renders the config-error screen when Supabase config is missing', () => {
    vi.stubEnv('VITE_E2E', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    render(<Root />);

    expect(screen.getByText(/no configurada/i)).toBeInTheDocument();
    expect(screen.queryByText('AuthenticatedApp')).not.toBeInTheDocument();
  });

  it('renders the app when the e2e auth starts authenticated', async () => {
    vi.stubEnv('VITE_E2E', '1');

    render(<Root />);

    expect(await screen.findByText('AuthenticatedApp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('ignores the e2e bypass in a production build and never renders the stub app', () => {
    vi.stubEnv('VITE_E2E', '1');
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    render(<Root />);

    // Production must not take the e2e auth/repositories fallback: with no
    // Supabase config it lands on the config-error screen, not the stub app.
    expect(screen.getByText(/no configurada/i)).toBeInTheDocument();
    expect(screen.queryByText('AuthenticatedApp')).not.toBeInTheDocument();
  });

  it('renders the login screen when the e2e auth starts off', async () => {
    vi.stubEnv('VITE_E2E', '1');
    localStorage.setItem('e2e:auth', 'off');

    render(<Root />);

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText('AuthenticatedApp')).not.toBeInTheDocument();
  });
});
