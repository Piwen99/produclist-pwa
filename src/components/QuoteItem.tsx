import { useCallback } from 'react';
import type { QuoteItem as QuoteItemType } from '../types/quote';
import { parseChileanNumber } from '../utils/price';

interface QuoteItemProps {
  item: QuoteItemType;
  onUpdateQty: (id: string, cantidad: number) => void;
  onUpdatePrecioKg: (id: string, precioKg: number) => void;
  onRemove: (id: string) => void;
}

export function QuoteItem({ item, onUpdateQty, onUpdatePrecioKg, onRemove }: QuoteItemProps) {
  const totalKg = parseChileanNumber(item.formato) * item.cantidad;
  const subtotal = totalKg * item.precioKg;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const qtyInputId = `qty-${item.id}`;
  const precioInputId = `precio-${item.id}`;

  const handleQtyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        onUpdateQty(item.id, Math.max(1, value));
      }
    },
    [item.id, onUpdateQty]
  );

  const handlePrecioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        onUpdatePrecioKg(item.id, Math.max(0, value));
      }
    },
    [item.id, onUpdatePrecioKg]
  );

  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  return (
    <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
            {item.nombre}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {item.formato} kg
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 ml-4">
        {/* Cantidad input */}
        <div className="flex flex-col items-center">
          <label htmlFor={qtyInputId} className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Cant.
          </label>
          <input
            type="number"
            id={qtyInputId}
            value={item.cantidad}
            onChange={handleQtyChange}
            min={1}
            className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Cantidad"
          />
        </div>

        {/* Precio/kg input */}
        <div className="flex flex-col items-center">
          <label htmlFor={precioInputId} className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            $/kg
          </label>
          <input
            type="number"
            id={precioInputId}
            value={item.precioKg}
            onChange={handlePrecioChange}
            min={0}
            className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Precio por kg"
          />
        </div>

        {/* Subtotal */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Subtotal
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
            {formatCurrency(subtotal).replace('CLP', '').trim()}
          </span>
        </div>

        {/* Remove button */}
        <button
          onClick={handleRemove}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors touch-manipulation"
          aria-label="Eliminar item"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
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
        </button>
      </div>
    </div>
  );
}