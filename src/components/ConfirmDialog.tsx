import { useRef, useCallback } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** Optional quoted subject, e.g. the name of the item being deleted. */
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional note rendered under the message. */
  note?: string;
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
  note = 'Esta acción no se puede deshacer.',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus trap, Escape handling, initial focus and focus restore.
  const { containerRef } = useModalA11y<HTMLDivElement>({
    active: isOpen,
    onClose: onCancel,
    initialFocusRef: cancelRef,
  });

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
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
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
          {itemName !== undefined && (
            <p className="text-center text-sm font-medium text-gray-900 dark:text-white mb-1 break-words">
              "{itemName}"
            </p>
          )}
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-6">
            {note}
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
