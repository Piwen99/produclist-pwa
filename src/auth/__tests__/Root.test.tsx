import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Root from '../../Root';

vi.mock('../../App', () => ({ default: () => 'AuthenticatedApp' }));

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

  it('ignores the e2e bypass in a production build', () => {
    vi.stubEnv('VITE_E2E', '1');
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    render(<Root />);

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
