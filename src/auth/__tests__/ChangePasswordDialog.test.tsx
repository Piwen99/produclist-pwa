import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordDialog } from '../ChangePasswordDialog';

function renderDialog(overrides: Partial<Parameters<typeof ChangePasswordDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const props = {
    onClose,
    onSubmit,
    ...overrides,
  };

  render(<ChangePasswordDialog {...props} />);

  return { onClose, onSubmit, props };
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  current: string,
  next: string,
  confirm = next,
) {
  await user.type(screen.getByLabelText('Contraseña actual'), current);
  await user.type(screen.getByLabelText('Nueva contraseña'), next);
  await user.type(screen.getByLabelText('Repetir nueva contraseña'), confirm);
}

describe('ChangePasswordDialog', () => {
  it('renders empty password fields and the actions', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('');
    expect(screen.getByLabelText('Repetir nueva contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await fill(user, 'current-secret', 'short');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La nueva contraseña debe tener al menos 8 caracteres.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await fill(user, 'current-secret', 'new-secret-1', 'new-secret-2');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas nuevas no coinciden.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a new password equal to the current one', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await fill(user, 'same-secret', 'same-secret');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La nueva contraseña debe ser distinta de la actual.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the current and new passwords and closes on success', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderDialog();
    await fill(user, 'current-secret', 'new-secret-1');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('current-secret', 'new-secret-1');
  });

  it('shows a safe message when the change fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('La contraseña actual no es correcta.'));
    const { onClose } = renderDialog({ onSubmit });
    await fill(user, 'wrong-secret', 'new-secret-1');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual no es correcta.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderDialog({ onSubmit });
    await fill(user, 'current-secret', 'new-secret-1');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();

    resolveSubmit();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).not.toBeDisabled(),
    );
  });

  it('rejects a 7-character password', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await fill(user, 'current-secret', '1234567');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La nueva contraseña debe tener al menos 8 caracteres.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts exactly 8 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderDialog();
    await fill(user, 'current-secret', '12345678');

    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('current-secret', '12345678');
  });

  it('never submits without a current password', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-secret-1');
    await user.type(screen.getByLabelText('Repetir nueva contraseña'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { onClose } = renderDialog({ onSubmit });
    await fill(user, 'current-secret', 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('dialog'));
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();

    resolveSubmit();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not submit twice while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderDialog({ onSubmit });
    await fill(user, 'current-secret', 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit();
  });
});
