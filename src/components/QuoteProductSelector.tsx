import { useState, useMemo, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { formatCurrency } from '../utils/price';
import { useModalA11y } from '../hooks/useModalA11y';
import type { Product } from '../types/product';

interface QuoteProductSelectorProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function QuoteProductSelector({ onSelect, onClose }: QuoteProductSelectorProps) {
  const products = useLiveQuery(
    () => db.products.toArray(),
    []
  );

  return <QuoteSelectorDialog products={products} onSelect={onSelect} onClose={onClose} />;
}

interface QuoteSelectorDialogProps {
  /** Undefined while the Dexie query is still resolving. */
  products: Product[] | undefined;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

function QuoteSelectorDialog({ products, onSelect, onClose }: QuoteSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = products !== undefined;

  // The dialog owns its chrome (title + close button), so the focus trap covers
  // them. `active` flips to true once products resolve; the trigger keeps focus
  // during the query, so focus is captured and restored correctly.
  const { containerRef } = useModalA11y<HTMLDivElement>({
    active: ready,
    onClose,
    initialFocusRef: inputRef,
  });

  const filteredProducts = useMemo(() => {
    // All products are quotable — available or not.
    if (!products) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter(p => p.nombre.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const handleSelect = useCallback(
    (product: Product) => {
      onSelect(product);
    },
    [onSelect]
  );

  const availableProducts = products?.filter(p => p.disponible) ?? [];

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-selector-title"
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2
          id="quote-selector-title"
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          Seleccionar Producto
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {!ready ? (
          <p className="text-gray-500 dark:text-gray-400 text-center">Cargando productos...</p>
        ) : (
          <>
            {/* Search input */}
            <div className="relative mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos…"
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                aria-label="Buscar productos"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation"
                  aria-label="Limpiar búsqueda"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {/* Product list */}
            {availableProducts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No hay productos disponibles
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No hay productos que coincidan con "{searchTerm}"
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {product.nombre}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {product.formato} kg
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {formatCurrency(product.precioNeto)}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}