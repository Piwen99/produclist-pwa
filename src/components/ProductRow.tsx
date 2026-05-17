import { useState, useCallback } from 'react';
import type { Product, ProductInput } from '../types/product';
import { calcPrecioBruto } from '../utils/price';
import { ConfirmDialog } from './ConfirmDialog';

interface ProductRowProps {
  product: Product;
  onUpdate: (id: number, changes: Partial<ProductInput>) => void;
  onDelete: (id: number) => void;
  onStartEdit: (product: Product) => void;
}

export function ProductRow({ product, onUpdate, onDelete, onStartEdit }: ProductRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const precioBruto = calcPrecioBruto(product.precioNeto);

  const handleDelete = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    if (product.id === undefined) return;
    onDelete(product.id);
  }, [onDelete, product]);

  const handleEdit = useCallback(() => {
    onStartEdit(product);
  }, [onStartEdit, product]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <div
        onDoubleClick={handleEdit}
        className={`product-row flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
          !product.disponible ? 'opacity-50' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
              {product.nombre}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {product.formato} kg
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (product.id === undefined) return;
                onUpdate(product.id, { disponible: !product.disponible });
              }}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors touch-manipulation cursor-pointer ${
                product.disponible
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label={product.disponible ? 'Marcar como no disponible' : 'Marcar como disponible'}
            >
              {product.disponible ? 'Disponible' : 'No disponible'}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatCurrency(precioBruto)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Neto: {formatCurrency(product.precioNeto)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors touch-manipulation"
              aria-label="Eliminar producto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              className="p-2 text-gray-400 hover:text-orange-500 transition-colors touch-manipulation"
              aria-label="Editar producto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showConfirm}
        title="Eliminar producto"
        message="¿Estás seguro de eliminar"
        itemName={product.nombre}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
