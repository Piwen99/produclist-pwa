import { useRef, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ListSendFormProps {
  /** How many products the snapshot will contain */
  productCount: number;
  /** Known client names, for autocomplete */
  clients: string[];
  onSave: (cliente: string) => void;
  onCancel: () => void;
}

/**
 * Ask for the client name before saving a snapshot of the price list.
 */
export function ListSendForm({ productCount, clients, onSave, onCancel }: ListSendFormProps) {
  const [cliente, setCliente] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus trap, Escape handling, initial focus and focus restore. The modal is
  // conditionally mounted, so it stays active for its whole lifetime.
  const { containerRef } = useModalA11y<HTMLDivElement>({
    active: true,
    onClose: onCancel,
    initialFocusRef: inputRef,
  });

  const trimmed = cliente.trim();
  const canSave = trimmed.length > 0 && productCount > 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="list-send-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave(trimmed);
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm"
      >
        <div className="p-5 sm:p-6">
          <h2
            id="list-send-title"
            className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-2"
          >
            Guardar lista enviada
          </h2>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-5">
            Se guardan los precios actuales de {String(productCount)} productos, para poder
            consultarlos después.
          </p>

          <label
            htmlFor="list-send-client"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Cliente
          </label>
          <input
            id="list-send-client"
            ref={inputRef}
            list="list-send-clients"
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <datalist id="list-send-clients">
            {clients.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={`w-full px-4 py-3 text-sm font-medium rounded-md transition-colors touch-manipulation ${
                canSave
                  ? 'text-white bg-orange-500 hover:bg-orange-600'
                  : 'text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
              }`}
            >
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
