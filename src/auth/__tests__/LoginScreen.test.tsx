import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../AuthProvider';
import { LoginScreen } from '../LoginScreen';
import { createFakeAuth } from '../testing/fakeAuth';
import type { AuthPort } from '../ports';

function renderLogin(auth: AuthPort = createFakeAuth()) {
  return render(
    <AuthProvider auth={auth}>
      <LoginScreen />
    </AuthProvider>,
  );
}

describe('LoginScreen', () => {
  it('renders Spanish labels tied to email and password inputs', () => {
    renderLogin();

    const email = screen.getByLabelText('Correo electrónico');
    const password = screen.getByLabelText('Contraseña');

    expect(email).toHaveAttribute('type', 'email');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('submits the entered credentials', async () => {
    const user = userEvent.setup();
    const auth = createFakeAuth();
    const signIn = vi.spyOn(auth, 'signIn');
    renderLogin(auth);

    await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(signIn).toHaveBeenCalledWith('vendedor@example.com', 'secret');
  });

  it('shows a single generic message on failure without leaking raw errors', async () => {
    const user = userEvent.setup();
    const auth = createFakeAuth();
    vi.spyOn(auth, 'signIn').mockRejectedValue(new Error('Invalid login credentials'));
    renderLogin(auth);

    await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(alert).not.toHaveTextContent('Invalid login credentials');
  });

  it('disables the submit button while submitting', async () => {
    const user = userEvent.setup();
    let resolveSignIn: () => void = () => {};
    const auth = createFakeAuth();
    vi.spyOn(auth, 'signIn').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderLogin(auth);

    await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();

    await act(async () => {
      resolveSignIn();
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).not.toBeDisabled(),
    );
  });
});
