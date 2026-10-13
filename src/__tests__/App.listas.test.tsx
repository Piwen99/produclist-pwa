import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Root from '../Root';
import { ToastProvider } from '../hooks/ToastProvider';

// jsdom does not implement matchMedia; InstallPrompt (rendered by App) probes it.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

vi.mock('../components/PDFButton', () => ({
  PDFButton: () => <button type="button">Generar PDF</button>,
}));
vi.mock('../components/QuotePDFButton', () => ({
  QuotePDFButton: () => <button type="button">Exportar PDF</button>,
}));

function renderRoot(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('Application sent-lists route', () => {
  it('renders the ListSends screen on the /listas route', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/listas');

    expect(
      await screen.findByRole('heading', { name: /listas enviadas/i }),
    ).toBeInTheDocument();
  });

  it('exposes a "Listas" nav link pointing to /listas', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    // "Listas" now appears in both the desktop top tabs and the mobile bottom
    // bar, so scope the query to the primary navigation landmark.
    const bottomNav = await screen.findByRole('navigation', {
      name: 'Navegación principal',
    });
    const link = within(bottomNav).getByRole('link', { name: 'Listas' });
    expect(link).toHaveAttribute('href', '/listas');
  });
});
