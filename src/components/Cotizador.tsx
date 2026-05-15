import { useState } from 'react';
import { QuoteItem } from './QuoteItem';
import { QuoteProductSelector } from './QuoteProductSelector';
import { QuoteShareButton } from './QuoteShareButton';
import type { QuoteItem as QuoteItemType, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';

interface CotizadorProps {
  items: QuoteItemType[];
  totals: QuoteTotals;
  onAddProduct: (product: Product) => void;
  onUpdateQty: (id: string, cantidad: number) => void;
  onUpdatePrecioKg: (id: string, precioKg: number) => void;
  onRemove: (id: string) => void;
}

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Chilean decimal format for kg display
const chileanFormat = (n: number) => n.toFixed(1).replace('.', ',');

export function Cotizador({ items, totals, onAddProduct, onUpdateQty, onUpdatePrecioKg, onRemove }: CotizadorProps) {
  const [showSelector, setShowSelector] = useState(false);

  const handleOpenSelector = () => setShowSelector(true);
  const handleCloseSelector = () => setShowSelector(false);
  const handleSelectProduct = (product: Product) => {
    onAddProduct(product);
    setShowSelector(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cotizador</h2>
        <button
          onClick={handleOpenSelector}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar producto
        </button>
      </div>

      {/* Items list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Agregá productos para comenzar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <QuoteItem
                key={item.id}
                item={item}
                onUpdateQty={(id, qty) => onUpdateQty(id, qty)}
                onUpdatePrecioKg={(id, price) => onUpdatePrecioKg(id, price)}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total kg:</span>
            <span className="text-gray-900 dark:text-white font-medium">{chileanFormat(totals.totalKg)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Subtotal Neto:</span>
            <span className="text-gray-900 dark:text-white font-medium">{clpFormatter.format(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">IVA 19%:</span>
            <span className="text-gray-900 dark:text-white font-medium">{clpFormatter.format(totals.iva)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="text-gray-900 dark:text-white font-semibold">Total a pagar:</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold text-base">{clpFormatter.format(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Share button */}
      <div className="mt-4">
        <QuoteShareButton items={items} totals={totals} />
      </div>

      {/* Product selector modal */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Seleccionar Producto</h3>
              <button
                onClick={handleCloseSelector}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuoteProductSelector onSelect={handleSelectProduct} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}