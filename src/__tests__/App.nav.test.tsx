import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Root from '../Root';
import { ToastProvider } from '../hooks/ToastProvider';
import { DRAFT_STORAGE_KEY, draftStorageKey } from '../data/local/draftsRepo';

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

describe('Contextual create-product action', () => {  it('shows the create-product action on the Productos route', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    expect(
      await screen.findByRole('button', { name: 'Nuevo producto' }),
    ).toBeInTheDocument();
  });

  it.each(['/cotizador', '/historial', '/listas', '/clientes'])(
    'hides the create-product action on %s',
    async (route) => {
      vi.stubEnv('VITE_E2E', '1');
      const { unmount } = renderRoot(route);

      // The bottom bar always renders, so it marks the shell as mounted.
      await screen.findByRole('navigation', { name: 'Navegación principal' });
      expect(
        screen.queryByRole('button', { name: 'Nuevo producto' }),
      ).not.toBeInTheDocument();

      unmount();
    },
  );
});

describe('Sign-out storage cleanup (issue #90)', () => {
  it('removes the persisted draft for the user who signed out, and the legacy key', async () => {
    vi.stubEnv('VITE_E2E', '1');
    renderRoot('/');

    await screen.findByRole('navigation', { name: 'Navegación principal' });

    // The e2e session's user id, plus a device-wide key left by an older build.
    const userKey = draftStorageKey('e2e-user');
    localStorage.setItem(
      userKey,
      JSON.stringify({ items: [{ id: 'i1', productId: 1, nombre: 'De e2e', formato: '10', cantidad: 1, precioKg: 100 }], totalNeto: 1000, iva: 190, total: 1190 }),
    );
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ items: [], totalNeto: 0, iva: 0, total: 0 }));

    fireEvent.click(screen.getByRole('button', { name: 'Menú de opciones' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(localStorage.getItem(userKey)).toBeNull());
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });
});
