import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
  sessionStorage.clear();
});

describe('Change password from the options menu', () => {
  it('opens the dialog from the menu entry', async () => {
    const user = userEvent.setup();
    vi.stubEnv('VITE_E2E', '1');
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Menú de opciones' }));
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Repetir nueva contraseña')).toBeInTheDocument();
  });

  it('closes the dialog and reports success', async () => {
    const user = userEvent.setup();
    vi.stubEnv('VITE_E2E', '1');
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Menú de opciones' }));
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Contraseña actual'), 'current-secret');
    await user.type(within(dialog).getByLabelText('Nueva contraseña'), 'new-secret-1');
    await user.type(within(dialog).getByLabelText('Repetir nueva contraseña'), 'new-secret-1');
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByText('Contraseña actualizada.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open with a safe message when validation fails', async () => {
    const user = userEvent.setup();
    vi.stubEnv('VITE_E2E', '1');
    renderRoot();

    await user.click(await screen.findByRole('button', { name: 'Menú de opciones' }));
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Contraseña actual'), 'current-secret');
    await user.type(within(dialog).getByLabelText('Nueva contraseña'), 'new-secret-1');
    await user.type(within(dialog).getByLabelText('Repetir nueva contraseña'), 'other-secret-1');
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar contraseña' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Las contraseñas nuevas no coinciden.',
    );
  });
});
