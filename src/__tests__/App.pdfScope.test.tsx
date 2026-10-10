import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Application PDF button is scoped to the product list route', () => {
  it('renders the PDF button on the product list route', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    expect(await screen.findByRole('button', { name: /generar pdf/i })).toBeInTheDocument();
  });

  it('does not render the PDF button on the cotizador route', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/cotizador');

    await screen.findByRole('heading', { name: /cotizador/i });
    expect(screen.queryByRole('button', { name: /generar pdf/i })).not.toBeInTheDocument();
  });

  it('does not render the PDF button on the historial route', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/historial');

    await screen.findByText(/no hay cotizaciones guardadas/i);
    expect(screen.queryByRole('button', { name: /generar pdf/i })).not.toBeInTheDocument();
  });
});
