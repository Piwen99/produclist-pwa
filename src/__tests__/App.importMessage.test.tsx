import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

/** A v3 backup with one new product, plus the list sends the case needs. */
function backupJson(listSends: unknown[]): string {
  return JSON.stringify({
    version: 3,
    exportedAt: '2026-01-01T00:00:00.000Z',
    products: [
      {
        nombre: 'PRODUCTO NUEVO T3',
        categoria: 'Frutos Secos',
        formato: '1,00',
        precioNeto: 1000,
        disponible: true,
      },
    ],
    quotes: [],
    listSends,
  });
}

function listSend(cliente: string): unknown {
  return {
    fecha: '2026-01-01T00:00:00.000Z',
    cliente,
    items: [
      { nombre: 'ALMENDRA LAMINADA', formato: '1,00', precioNeto: 1000, precioBruto: 1190 },
    ],
  };
}

function renderShell() {
  vi.stubEnv('VITE_E2E', '1');
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/**
 * Drive the real export/import path: hand a backup to the shell's hidden
 * `<input type="file">`, which runs `previewImport` and opens the dialog.
 */
async function uploadBackup(container: HTMLElement, json: string): Promise<void> {
  // Wait for the authenticated shell to mount before reaching for its input.
  await screen.findByRole('navigation', { name: 'Navegación principal' });
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  const file = new File([json], 'backup.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('Import confirmation message', () => {
  it('omits the list-send clause when the backup carries no list sends', async () => {
    const { container } = renderShell();
    await uploadBackup(container, backupJson([]));

    const dialog = await screen.findByRole('dialog');
    const message = within(dialog).getByText(/^Se agregarán/);

    expect(message).toHaveTextContent(
      'Se agregarán 1, se actualizarán 0 productos y se sumarán 0 cotizaciones.',
    );
    expect(message).not.toHaveTextContent('listas enviadas');
  });

  it('keeps the list-send clause with the real count when the backup has list sends', async () => {
    const { container } = renderShell();
    await uploadBackup(container, backupJson([listSend('Ana'), listSend('Beto')]));

    const dialog = await screen.findByRole('dialog');
    const message = within(dialog).getByText(/^Se agregarán/);

    expect(message).toHaveTextContent(
      'Se agregarán 1, se actualizarán 0 productos y se sumarán 0 cotizaciones y 2 listas enviadas.',
    );
  });
});
