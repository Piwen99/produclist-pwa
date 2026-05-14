import { useEffect, useRef, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  itemName,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button on open
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is in the DOM
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [isOpen]);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  // Handle click outside (on the overlay)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-auto">
        <div className="p-5 sm:p-6">
          {/* Icon */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>

          {/* Title */}
          <h2
            id="confirm-dialog-title"
            className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-2"
          >
            {title}
          </h2>

          {/* Message */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-1">
            {message}
          </p>
          <p className="text-center text-sm font-medium text-gray-900 dark:text-white mb-1 break-words">
            "{itemName}"
          </p>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-6">
            Esta acción no se puede deshacer.
          </p>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors touch-manipulation"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-md transition-colors touch-manipulation"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
