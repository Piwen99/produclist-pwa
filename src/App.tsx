import { useEffect, useState, useCallback, useRef } from 'react';
import { seedDatabase } from './db/seed';
import { useProducts } from './hooks/useProducts';
import { useAddProduct } from './hooks/useAddProduct';
import { useUpdateProduct } from './hooks/useUpdateProduct';
import { useDeleteProduct } from './hooks/useDeleteProduct';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { PDFButton } from './components/PDFButton';
import { InstallPrompt } from './components/InstallPrompt';
import { exportToJSON, exportToCSV, importProducts } from './utils/exportImport';
import type { Product, ProductInput } from './types/product';
import './App.css';

function App() {
  const products = useProducts();
  const { add } = useAddProduct();
  const { update } = useUpdateProduct();
  const { remove } = useDeleteProduct();

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const message = error instanceof Error ? error.message : 'Error al crear el producto. Por favor intenta de nuevo.';
      console.error('Error adding product:', error);
      alert(message);
    }
  }, [add]);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingProduct(null);
  }, []);

  const handleUpdateProduct = useCallback(async (id: number, changes: Partial<ProductInput>) => {
    try {
      await update(id, changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el producto.';
      console.error('Error updating product:', error);
      alert(message);
    }
  }, [update]);

  const handleSaveEdit = useCallback(async (data: ProductInput) => {
    if (!editingProduct?.id) return;
    try {
      await update(editingProduct.id, data);
      setEditingProduct(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el producto.';
      console.error('Error updating product:', error);
      alert(message);
    }
  }, [update, editingProduct]);

  const handleDeleteProduct = useCallback(async (id: number) => {
    try {
      await remove(id);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto. Por favor intenta de nuevo.');
    }
  }, [remove]);

  const handleExportJSON = useCallback(() => {
    if (!products) return;
    exportToJSON(products);
  }, [products]);

  const handleExportCSV = useCallback(() => {
    if (!products) return;
    exportToCSV(products);
  }, [products]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importProducts(file);
      const parts: string[] = [];
      if (result.success > 0) parts.push(`${result.success} agregados`);
      if (result.updated > 0) parts.push(`${result.updated} actualizados`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} errores`);

      setImportMessage(`Importación completada: ${parts.join(', ')}.`);
      if (result.errors.length > 0) {
        console.warn('[Import] Errors:', result.errors);
      }
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Error al importar.');
    }

    // Reset file input so the same file can be re-selected
    e.target.value = '';
  }, []);

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
            {/* Export buttons */}
            <button
              onClick={handleExportJSON}
              disabled={!hasProducts}
              title="Exportar JSON"
              className="p-2 text-gray-500 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="Exportar productos como JSON"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!hasProducts}
              title="Exportar CSV"
              className="p-2 text-gray-500 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="Exportar productos como CSV"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {/* Import button */}
            <button
              onClick={handleImportClick}
              title="Importar productos"
              className="p-2 text-gray-500 hover:text-orange-500 transition-colors touch-manipulation"
              aria-label="Importar productos desde archivo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
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

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        className="hidden"
        aria-hidden="true"
      />

      {/* Import message notification */}
      {importMessage && (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">{importMessage}</p>
            <button
              onClick={() => setImportMessage(null)}
              className="shrink-0 p-1 text-blue-500 hover:text-blue-700 transition-colors touch-manipulation"
              aria-label="Cerrar notificación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <ProductList
          products={products}
          onUpdate={handleUpdateProduct}
          onDelete={handleDeleteProduct}
          onStartEdit={handleEditProduct}
        />
      </main>

      {/* Floating PDF Button */}
      <PDFButton disabled={!hasProducts} />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Product Form - Create Modal */}
      {showForm && (
        <ProductForm
          onSubmit={handleSubmitProduct}
          onCancel={handleCloseForm}
        />
      )}

      {/* Product Form - Edit Modal */}
      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={handleSaveEdit}
          onCancel={handleCloseEdit}
        />
      )}

      {/* Footer spacer for mobile */}
      <div className="h-20 sm:h-24" aria-hidden="true" />
    </div>
  );
}

export default App;
