import { useCallback, useRef, useState, type SyntheticEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

const MIN_PASSWORD_LENGTH = 8;
const TOO_SHORT_MESSAGE = `La nueva contraseña debe tener al menos ${String(MIN_PASSWORD_LENGTH)} caracteres.`;
const MISMATCH_MESSAGE = 'Las contraseñas nuevas no coinciden.';
const SAME_MESSAGE = 'La nueva contraseña debe ser distinta de la actual.';
const GENERIC_MESSAGE = 'No se pudo actualizar la contraseña. Intenta de nuevo.';

interface ChangePasswordDialogProps {
  onClose: () => void;
  /** Rejects with a user-safe message. */
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function ChangePasswordDialog({ onClose, onSubmit }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentRef = useRef<HTMLInputElement>(null);

  // While the request is in flight the dialog owns the outcome: dismissing it
  // would drop a late error on an unmounted component.
  const requestClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const { containerRef } = useModalA11y<HTMLDivElement>({
    // Mounted only while open, so the trap is active for its whole lifetime.
    active: true,
    onClose: requestClose,
    initialFocusRef: currentRef,
  });

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(TOO_SHORT_MESSAGE);
      return;
    }
    if (newPassword !== confirmation) {
      setError(MISMATCH_MESSAGE);
      return;
    }
    if (newPassword === currentPassword) {
      setError(SAME_MESSAGE);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(currentPassword, newPassword);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-busy={submitting}
      aria-labelledby="change-password-title"
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-auto"
      >
        <div className="p-5 sm:p-6 space-y-4">
          <h2
            id="change-password-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Cambiar contraseña
          </h2>

          <div>
            <label
              htmlFor="change-password-current"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Contraseña actual
            </label>
            <input
              ref={currentRef}
              id="change-password-current"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label
              htmlFor="change-password-new"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Nueva contraseña
            </label>
            <input
              id="change-password-new"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label
              htmlFor="change-password-confirm"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Repetir nueva contraseña
            </label>
            <input
              id="change-password-confirm"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
            >
              Cambiar contraseña
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
