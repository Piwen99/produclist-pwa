import { useEffect, useState, useCallback } from 'react';
import { seedDatabase } from './db/seed';
import { useProducts } from './hooks/useProducts';
import { useAddProduct } from './hooks/useAddProduct';
import { useUpdateProduct } from './hooks/useUpdateProduct';
import { useDeleteProduct } from './hooks/useDeleteProduct';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { PDFButton } from './components/PDFButton';
import { InstallPrompt } from './components/InstallPrompt';
import type { ProductInput } from './types/product';
import './App.css';

function App() {
  const products = useProducts();
  const { add } = useAddProduct();
  const { update } = useUpdateProduct();
  const { remove } = useDeleteProduct();

  const [showForm, setShowForm] = useState(false);

  // Seed database on mount
  useEffect(() => {
    seedDatabase().catch(console.error);
  }, []);

  const handleAddNew = useCallback(() => {
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const handleSubmitProduct = useCallback(async (data: ProductInput) => {
    try {
      await add(data);
      setShowForm(false);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error al crear el producto. Por favor intenta de nuevo.');
    }
  }, [add]);

  const handleUpdateProduct = useCallback(async (id: number, changes: Partial<ProductInput>) => {
    try {
      await update(id, changes);
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error al actualizar el producto. Por favor intenta de nuevo.');
    }
  }, [update]);

  const handleDeleteProduct = useCallback(async (id: number) => {
    try {
      await remove(id);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto. Por favor intenta de nuevo.');
    }
  }, [remove]);

  const hasProducts = products && products.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">🥜</span>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                Produclist
              </h1>
            </div>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nuevo Producto</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <ProductList
          products={products}
          onUpdate={handleUpdateProduct}
          onDelete={handleDeleteProduct}
        />
      </main>

      {/* Floating PDF Button */}
      <PDFButton disabled={!hasProducts} />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          onSubmit={handleSubmitProduct}
          onCancel={handleCloseForm}
        />
      )}

      {/* Footer spacer for mobile */}
      <div className="h-20 sm:h-24" aria-hidden="true" />
    </div>
  );
}

export default App;
