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

describe('Responsive navigation shell', () => {
  it('exposes the five destinations in the bottom bar', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    const bottom = await screen.findByRole('navigation', {
      name: 'Navegación principal',
    });

    expect(within(bottom).getAllByRole('link')).toHaveLength(5);
    expect(within(bottom).getByRole('link', { name: 'Productos' })).toHaveAttribute('href', '/');
    expect(within(bottom).getByRole('link', { name: 'Cotizar' })).toHaveAttribute(
      'href',
      '/cotizador',
    );
    expect(within(bottom).getByRole('link', { name: 'Historial' })).toHaveAttribute(
      'href',
      '/historial',
    );
    expect(within(bottom).getByRole('link', { name: 'Listas' })).toHaveAttribute(
      'href',
      '/listas',
    );
    expect(within(bottom).getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'href',
      '/clientes',
    );
  });

  it('exposes the five labels in the desktop top tabs', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    const top = await screen.findByRole('navigation', {
      name: 'Navegación de secciones',
    });

    const labels = ['Productos', 'Cotizador', 'Historial', 'Listas', 'Clientes'];
    expect(within(top).getAllByRole('link')).toHaveLength(labels.length);
    for (const label of labels) {
      expect(within(top).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});
