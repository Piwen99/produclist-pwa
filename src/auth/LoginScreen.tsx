import { useState, type SyntheticEvent } from 'react';
import { useAuth } from './useAuth';
import {
  clearLastEmail,
  isRememberEnabled,
  readLastEmail,
  setRememberPreference,
  writeLastEmail,
} from './authStorage';

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(readLastEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(isRememberEnabled);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The storage target is read when the session is written, so the choice
      // has to be stored before signing in.
      setRememberPreference(remember);
      await signIn(email, password);
      if (remember) {
        writeLastEmail(email);
      } else {
        clearLastEmail();
      }
    } catch {
      // Never surface raw provider messages to the user.
      setError(INVALID_CREDENTIALS_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Iniciar sesión</h1>

        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Correo electrónico
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Contraseña
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label
            htmlFor="login-remember"
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <input
              id="login-remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900"
            />
            Recordarme
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mantiene la sesión abierta en este dispositivo. Tu navegador puede guardar la
            contraseña.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  );
}
