import { useState, useCallback } from 'react';
import type { Product, ProductInput, Category } from '../types/product';
import { ProductRow } from './ProductRow';

interface CategoryGroupProps {
  category: Category;
  products: Product[];
  onUpdate: (id: number, changes: Partial<ProductInput>) => void;
  onDelete: (id: number) => void;
  onStartEdit: (product: Product) => void;
}

const CATEGORY_ICONS: Record<Category, string> = {
  'Frutos Secos': '🥜',
  'Semillas/Cereal': '🌾',
  'Fruta Deshidratada': '🍎',
  'Legumbres': '🫘',
};

const CATEGORY_COLORS: Record<Category, string> = {
  'Frutos Secos': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Semillas/Cereal': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Fruta Deshidratada': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Legumbres': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export function CategoryGroup({ category, products, onUpdate, onDelete, onStartEdit }: CategoryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const availableCount = products.filter(p => p.disponible).length;

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="category-group mb-3 sm:mb-4">
      {/* Header - Touch friendly */}
      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-lg ${CATEGORY_COLORS[category]} transition-colors touch-manipulation`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-lg sm:text-xl" aria-hidden="true">
            {CATEGORY_ICONS[category]}
          </span>
          <div className="text-left">
            <h3 className="font-semibold text-sm sm:text-base">
              {category}
            </h3>
            <p className="text-xs opacity-80">
              {products.length} producto{products.length !== 1 ? 's' : ''}
              {availableCount !== products.length && (
                <span className="ml-1">
                  ({availableCount} disponible{availableCount !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70 hidden sm:inline">
            {isExpanded ? 'Colapsar' : 'Expandir'}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Product List */}
      {isExpanded && (
        <div className="mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onStartEdit={onStartEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
