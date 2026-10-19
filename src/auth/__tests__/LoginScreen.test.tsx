import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../AuthProvider';
import { LoginScreen } from '../LoginScreen';
import { createFakeAuth } from '../testing/fakeAuth';
import { LAST_EMAIL_KEY, REMEMBER_KEY } from '../authStorage';
import type { AuthPort } from '../ports';

function renderLogin(auth: AuthPort = createFakeAuth()) {
  return render(
    <AuthProvider auth={auth}>
      <LoginScreen />
    </AuthProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe('remember me', () => {
    it('starts unchecked on a device that never chose', () => {
      renderLogin();

      expect(screen.getByRole('checkbox', { name: 'Recordarme' })).not.toBeChecked();
    });

    it('reflects the stored preference', () => {
      localStorage.setItem(REMEMBER_KEY, '1');
      renderLogin();

      expect(screen.getByRole('checkbox', { name: 'Recordarme' })).toBeChecked();
    });

    it('prefills the remembered email', () => {
      localStorage.setItem(LAST_EMAIL_KEY, 'vendedor@example.com');
      renderLogin();

      expect(screen.getByLabelText('Correo electrónico')).toHaveValue('vendedor@example.com');
    });

    it('sets the storage preference before signing in and remembers the email', async () => {
      const user = userEvent.setup();
      const auth = createFakeAuth();
      const signIn = vi.spyOn(auth, 'signIn');
      renderLogin(auth);

      await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
      await user.type(screen.getByLabelText('Contraseña'), 'secret');
      await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(signIn).toHaveBeenCalledWith('vendedor@example.com', 'secret');
      expect(localStorage.getItem(REMEMBER_KEY)).toBe('1');
      expect(localStorage.getItem(LAST_EMAIL_KEY)).toBe('vendedor@example.com');
    });

    it('forgets the email when submitting unchecked', async () => {
      const user = userEvent.setup();
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(LAST_EMAIL_KEY, 'old@example.com');
      renderLogin();

      await user.clear(screen.getByLabelText('Correo electrónico'));
      await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
      await user.type(screen.getByLabelText('Contraseña'), 'secret');
      await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(localStorage.getItem(REMEMBER_KEY)).toBe('0');
      expect(localStorage.getItem(LAST_EMAIL_KEY)).toBeNull();
    });

    it('forgets the remembered email when an unchecked sign-in fails', async () => {
      const user = userEvent.setup();
      const auth = createFakeAuth();
      vi.spyOn(auth, 'signIn').mockRejectedValue(new Error('Invalid login credentials'));
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(LAST_EMAIL_KEY, 'old@example.com');
      renderLogin(auth);

      await user.clear(screen.getByLabelText('Correo electrónico'));
      await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
      await user.type(screen.getByLabelText('Contraseña'), 'wrong');
      await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Correo o contraseña incorrectos.',
      );
      expect(localStorage.getItem(LAST_EMAIL_KEY)).toBeNull();
    });
  });

  describe('degraded storage', () => {
    it('signs in when Web Storage throws on read and write', async () => {
      const user = userEvent.setup();
      const auth = createFakeAuth();
      const signIn = vi.spyOn(auth, 'signIn');
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });
      renderLogin(auth);

      await user.type(screen.getByLabelText('Correo electrónico'), 'vendedor@example.com');
      await user.type(screen.getByLabelText('Contraseña'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(signIn).toHaveBeenCalledWith('vendedor@example.com', 'secret');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
