import { useMemo } from 'react';
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
  // Group products by category
  const groupedProducts = useMemo(() => {
    if (!products) return {} as Record<Category, Product[]>;

    const grouped: Partial<Record<Category, Product[]>> = {};

    // Initialize all categories with empty arrays
    CATEGORY_ORDER.forEach(cat => {
      grouped[cat] = [];
    });

    // Group products
    products.forEach(product => {
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
  }, [products]);

  // Check if we have any products
  const hasProducts = products && products.length > 0;
  const totalCount = products?.length ?? 0;
  const availableCount = products?.filter(p => p.disponible).length ?? 0;

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
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">{totalCount}</span> producto{totalCount !== 1 ? 's' : ''} en total
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-green-600 dark:text-green-400">{availableCount}</span> disponible{availableCount !== 1 ? 's' : ''}
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

      {/* Empty state for when no categories have products */}
      {CATEGORY_ORDER.every(cat => !groupedProducts[cat] || groupedProducts[cat].length === 0) && (
        <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No hay productos en ninguna categoría.
          </p>
        </div>
      )}
    </div>
  );
}
