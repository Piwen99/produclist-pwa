import { useState, useCallback } from 'react';
import type { Product, ProductInput, Category } from '../types/product';
import { calcPrecioBruto } from '../utils/price';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductInput) => void;
  onCancel: () => void;
}

const CATEGORIES: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const isEditing = !!product;

  const [formData, setFormData] = useState<ProductInput>({
    nombre: product?.nombre ?? '',
    formato: product?.formato ?? '',
    precioNeto: product?.precioNeto ?? 0,
    categoria: product?.categoria ?? 'Frutos Secos',
    disponible: product?.disponible ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (formData.precioNeto < 0) {
      newErrors.precioNeto = 'El precio no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  }, [formData, onSubmit, validate]);

  const updateField = useCallback(<K extends keyof ProductInput>(
    field: K,
    value: ProductInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const precioBruto = calcPrecioBruto(formData.precioNeto);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nombre"
                value={formData.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
                className={`w-full px-3 py-3 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation ${
                  errors.nombre ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Nombre del producto"
              />
              {errors.nombre && (
                <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría
              </label>
              <select
                id="categoria"
                value={formData.categoria}
                onChange={(e) => updateField('categoria', e.target.value as Category)}
                className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Formato */}
            <div>
              <label htmlFor="formato" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Formato (kg)
              </label>
              <input
                type="text"
                id="formato"
                value={formData.formato}
                onChange={(e) => updateField('formato', e.target.value)}
                className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation"
                placeholder="Ej: 11,34"
              />
            </div>

            {/* Precio Neto */}
            <div>
              <label htmlFor="precioNeto" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Precio Neto <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="precioNeto"
                min="0"
                step="1"
                value={formData.precioNeto}
                onChange={(e) => updateField('precioNeto', Number(e.target.value))}
                className={`w-full px-3 py-3 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white touch-manipulation ${
                  errors.precioNeto ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0"
              />
              {errors.precioNeto && (
                <p className="mt-1 text-xs text-red-500">{errors.precioNeto}</p>
              )}
            </div>

            {/* Precio Bruto calculado */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Precio Bruto (con IVA 19%):
              </p>
              <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                {formatCurrency(precioBruto)}
              </p>
            </div>

            {/* Disponible */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.disponible}
                  onChange={(e) => updateField('disponible', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 touch-manipulation"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Producto disponible
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors touch-manipulation"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
              >
                {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
