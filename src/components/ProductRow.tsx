import { useState, useCallback } from 'react';
import type { Product, ProductInput, Category } from '../types/product';
import { calcPrecioBruto } from '../utils/price';
import { ConfirmDialog } from './ConfirmDialog';

interface ProductRowProps {
  product: Product;
  onUpdate: (id: number, changes: Partial<ProductInput>) => void;
  onDelete: (id: number) => void;
}

const CATEGORIES: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

export function ProductRow({ product, onUpdate, onDelete }: ProductRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editData, setEditData] = useState<ProductInput>({
    nombre: product.nombre,
    formato: product.formato,
    precioNeto: product.precioNeto,
    categoria: product.categoria,
    disponible: product.disponible,
  });

  const precioBruto = calcPrecioBruto(product.precioNeto);

  const handleStartEdit = useCallback(() => {
    setEditData({
      nombre: product.nombre,
      formato: product.formato,
      precioNeto: product.precioNeto,
      categoria: product.categoria,
      disponible: product.disponible,
    });
    setIsEditing(true);
  }, [product]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(() => {
    const changes: Partial<ProductInput> = {};
    if (editData.nombre !== product.nombre) changes.nombre = editData.nombre;
    if (editData.formato !== product.formato) changes.formato = editData.formato;
    if (editData.precioNeto !== product.precioNeto) changes.precioNeto = editData.precioNeto;
    if (editData.categoria !== product.categoria) changes.categoria = editData.categoria;
    if (editData.disponible !== product.disponible) changes.disponible = editData.disponible;

    if (Object.keys(changes).length > 0) {
      onUpdate(product.id!, changes);
    }
    setIsEditing(false);
  }, [editData, product, onUpdate]);

  const handleDelete = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    onDelete(product.id!);
  }, [onDelete, product]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
    {isEditing ? (
      <div className="product-row product-row--editing bg-white dark:bg-gray-800 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={editData.nombre}
              onChange={(e) => setEditData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
              placeholder="Nombre del producto"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Formato
            </label>
            <input
              type="text"
              value={editData.formato}
              onChange={(e) => setEditData(prev => ({ ...prev, formato: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
              placeholder="Ej: 11,34"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Categoría
            </label>
            <select
              value={editData.categoria}
              onChange={(e) => setEditData(prev => ({ ...prev, categoria: e.target.value as Category }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Precio Neto
            </label>
            <input
              type="number"
              min="0"
              value={editData.precioNeto}
              onChange={(e) => setEditData(prev => ({ ...prev, precioNeto: Number(e.target.value) }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Precio Bruto (calculado)
            </label>
            <div className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
              {formatCurrency(calcPrecioBruto(editData.precioNeto))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editData.disponible}
                onChange={(e) => setEditData(prev => ({ ...prev, disponible: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 touch-manipulation"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Disponible</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSaveEdit}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
          >
            Guardar
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors touch-manipulation"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors ml-auto touch-manipulation"
          >
            Eliminar
          </button>
        </div>
      </div>
    ) : (
    <div
      onDoubleClick={handleStartEdit}
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
              onUpdate(product.id!, { disponible: !product.disponible });
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
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
  )}
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
</>);
}
