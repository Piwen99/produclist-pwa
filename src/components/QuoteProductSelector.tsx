import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Product } from '../types/product';

interface QuoteProductSelectorProps {
  onSelect: (product: Product) => void;
}

export function QuoteProductSelector({ onSelect }: QuoteProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const products = useLiveQuery(
    () => db.products.where('disponible').equals(1).toArray(),
    []
  );

  const filteredProducts = useMemo(() => {
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

  if (!products) {
    return (
      <div className="p-4">
        <p className="text-gray-500 dark:text-gray-400 text-center">Cargando productos...</p>
      </div>
    );
  }

  const availableProducts = products.filter(p => p.disponible);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Seleccionar Producto
      </h2>

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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}