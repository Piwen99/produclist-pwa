import { useState } from 'react';
import {
  daysSinceLastBackup,
  shouldRemindBackup,
  snoozeBackupReminder,
} from '../utils/backupReminder';

interface BackupReminderProps {
  onExport: () => void;
}

/**
 * Dismissible nudge to export a backup, shown when the user has not exported
 * for a while. The catalog only exists in this browser, so the JSON export is
 * the only thing that survives clearing the browser or changing phone.
 */
export function BackupReminder({ onExport }: BackupReminderProps) {
  const [visible, setVisible] = useState(() => shouldRemindBackup());

  if (!visible) return null;

  const days = daysSinceLastBackup();
  const message =
    days === null
      ? 'Todavía no exportaste un respaldo de la lista.'
      : `Hace ${String(days)} días que no exportás un respaldo.`;

  return (
    <div
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
      role="status"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      <p className="flex-1">
        {message} Si se limpia el navegador o cambiás de teléfono, se pierde.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onExport();
            setVisible(false);
          }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors touch-manipulation"
        >
          Exportar ahora
        </button>
        <button
          type="button"
          aria-label="Descartar recordatorio"
          onClick={() => {
            snoozeBackupReminder();
            setVisible(false);
          }}
          className="p-1.5 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors touch-manipulation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
