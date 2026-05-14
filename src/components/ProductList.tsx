import { useMemo, useState, useRef, useEffect } from 'react';
import type { Product, ProductInput, Category } from '../types/product';
import { CategoryGroup } from './CategoryGroup';

interface ProductListProps {
  products: Product[] | undefined;
  onUpdate: (id: number, changes: Partial<ProductInput>) => void;
  onDelete: (id: number) => void;
}

const CATEGORY_ORDER: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

export function ProductList({ products, onUpdate, onDelete }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter products by name + availability
  const filteredProducts = useMemo(() => {
    if (!products) return undefined;

    let result = products;

    // Filter by search term
    const term = searchTerm.trim();
    if (term) {
      const lower = term.toLowerCase();
      result = result.filter(p => p.nombre.toLowerCase().includes(lower));
    }

    // Filter by availability
    if (showAvailableOnly) {
      result = result.filter(p => p.disponible);
    }

    return result;
  }, [products, searchTerm, showAvailableOnly]);

  // Group filtered products by category
  const groupedProducts = useMemo(() => {
    if (!filteredProducts) return {} as Record<Category, Product[]>;

    const grouped: Partial<Record<Category, Product[]>> = {};

    // Initialize all categories with empty arrays
    CATEGORY_ORDER.forEach(cat => {
      grouped[cat] = [];
    });

    // Group products
    filteredProducts.forEach(product => {
      if (!grouped[product.categoria]) {
        grouped[product.categoria] = [];
      }
      grouped[product.categoria]!.push(product);
    });

    // Sort products within each category by name
    CATEGORY_ORDER.forEach(cat => {
      if (grouped[cat]) {
        grouped[cat]!.sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
    });

    return grouped as Record<Category, Product[]>;
  }, [filteredProducts]);

  // Check if we have any products
  const hasProducts = products && products.length > 0;
  const totalCount = products?.length ?? 0;
  const isSearching = searchTerm.trim().length > 0;
  const filteredCount = filteredProducts?.length ?? 0;
  const hasFilteredResults = filteredCount > 0;
  const hasGroupedResults = CATEGORY_ORDER.some(cat => (groupedProducts[cat]?.length ?? 0) > 0);

  // Keyboard shortcut: Ctrl+/ or Cmd+/ to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!products) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"></div>
        </div>
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">
          Cargando productos...
        </p>
      </div>
    );
  }

  if (!hasProducts) {
    return (
      <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 mx-auto text-gray-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          Sin productos
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          La base de datos está vacía. Los productos se cargarán automáticamente al iniciar la aplicación.
        </p>
      </div>
    );
  }

  return (
    <div className="product-list">
      {/* Search bar */}
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
          placeholder="Buscar productos…  Ctrl+/"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
          aria-label="Buscar productos por nombre"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation"
            aria-label="Limpiar búsqueda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter toggle switch */}
          <label className="inline-flex items-center gap-2 cursor-pointer touch-manipulation select-none">
            <input
              type="checkbox"
              checked={showAvailableOnly}
              onChange={() => setShowAvailableOnly(prev => !prev)}
              className="sr-only peer"
              aria-label="Filtrar solo productos disponibles"
            />
            <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-1 ${
              showAvailableOnly
                ? 'bg-green-500'
                : 'bg-gray-200 dark:bg-gray-600'
            }`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                showAvailableOnly ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <span className={`text-xs font-medium transition-colors ${showAvailableOnly ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Solo disponibles
            </span>
          </label>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {isSearching || showAvailableOnly ? (
            <>
              <span className="font-medium text-gray-900 dark:text-white">{filteredCount}</span> de{' '}
              <span className="font-medium text-gray-900 dark:text-white">{totalCount}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-gray-900 dark:text-white">{totalCount}</span> producto{totalCount !== 1 ? 's' : ''}
            </>
          )}
        </div>
      </div>

      {/* Category Groups */}
      <div className="space-y-2 sm:space-y-4">
        {CATEGORY_ORDER.map(category => {
          const categoryProducts = groupedProducts[category];
          if (!categoryProducts || categoryProducts.length === 0) {
            return null;
          }

          return (
            <CategoryGroup
              key={category}
              category={category}
              products={categoryProducts}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {/* Empty search result */}
      {isSearching && !hasFilteredResults && (
        <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 mx-auto text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {showAvailableOnly
              ? <>No hay productos disponibles que coincidan con <strong>"{searchTerm}"</strong></>
              : <>No hay productos que coincidan con <strong>"{searchTerm}"</strong></>
            }
          </p>
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() => { setSearchTerm(''); inputRef.current?.focus(); }}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors touch-manipulation"
            >
              Limpiar búsqueda
            </button>
            {showAvailableOnly && (
              <button
                onClick={() => setShowAvailableOnly(false)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors touch-manipulation"
              >
                Mostrar todos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state for when no categories have products */}
      {!isSearching && !hasGroupedResults && !showAvailableOnly && (
        <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No hay productos en ninguna categoría.
          </p>
        </div>
      )}

      {/* Empty state when filtering by available but no results */}
      {!isSearching && !hasGroupedResults && showAvailableOnly && (
        <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 mx-auto text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay productos disponibles.
          </p>
          <button
            onClick={() => setShowAvailableOnly(false)}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors touch-manipulation"
          >
            Mostrar todos
          </button>
        </div>
      )}
    </div>
  );
}
