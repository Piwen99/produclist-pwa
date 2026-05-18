import { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { seedDatabase } from './db/seed';
import { useProducts } from './hooks/useProducts';
import { useAddProduct } from './hooks/useAddProduct';
import { useUpdateProduct } from './hooks/useUpdateProduct';
import { useDeleteProduct } from './hooks/useDeleteProduct';
import { useQuote } from './hooks/useQuote';
import { useToast } from './hooks/useToast';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { PDFButton } from './components/PDFButton';
import { InstallPrompt } from './components/InstallPrompt';
import { Cotizador } from './components/Cotizador';
import { QuoteHistory } from './components/QuoteHistory';
import { exportToJSON, exportToCSV, importProducts } from './utils/exportImport';
import type { Product, ProductInput } from './types/product';
import './App.css';

function App() {
  const products = useProducts();
  const { add } = useAddProduct();
  const { update } = useUpdateProduct();
  const { remove } = useDeleteProduct();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cotizador state
  const { items, addItem, removeItem, updateItemQty, updateItemPrecioKg, totals } = useQuote();

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
      toast.error(message);
    }
  }, [add, toast]);

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
      toast.error(message);
    }
  }, [update, toast]);

  const handleSaveEdit = useCallback(async (data: ProductInput) => {
    if (!editingProduct?.id) return;
    try {
      await update(editingProduct.id, data);
      setEditingProduct(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el producto.';
      console.error('Error updating product:', error);
      toast.error(message);
    }
  }, [update, editingProduct, toast]);

  const handleDeleteProduct = useCallback(async (id: number) => {
    try {
      await remove(id);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto. Por favor intenta de nuevo.');
    }
  }, [remove, toast]);

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
      if (result.success > 0) parts.push(`${String(result.success)} agregados`);
      if (result.updated > 0) parts.push(`${String(result.updated)} actualizados`);
      if (result.errors.length > 0) parts.push(`${String(result.errors.length)} errores`);

      toast.success(`Importación completada: ${parts.join(', ')}.`);
      if (result.errors.length > 0) {
        console.warn('[Import] Errors:', result.errors);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar.');
    }

    // Reset file input so the same file can be re-selected
    e.target.value = '';
  }, [toast]);

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
              {/* View tabs */}
              <nav className="flex items-center ml-4 border-l border-gray-200 dark:border-gray-700 pl-4">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors touch-manipulation ${
                      isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Productos
                </NavLink>
                <NavLink
                  to="/cotizador"
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors touch-manipulation ml-1 ${
                      isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Cotizador
<<<<<<< HEAD
                </NavLink>
                <NavLink
                  to="/historial"
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors touch-manipulation ml-1 ${
                      isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Historial
                </NavLink>
              </nav>
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
        onChange={(e) => { void handleImportFile(e); }}
        className="hidden"
        aria-hidden="true"
      />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
<<<<<<< HEAD
        <Routes>
          <Route index element={
            <ProductList
              products={products}
              onUpdate={(id, changes) => { void handleUpdateProduct(id, changes); }}
              onDelete={(id) => { void handleDeleteProduct(id); }}
              onStartEdit={handleEditProduct}
            />
          } />
          <Route path="cotizador" element={
            <Cotizador
              items={items}
              totals={totals}
              onAddProduct={addItem}
              onUpdateQty={updateItemQty}
              onUpdatePrecioKg={updateItemPrecioKg}
              onRemove={removeItem}
            />
          } />
          <Route path="historial" element={<QuoteHistory />} />
        </Routes>
      </main>

      {/* Floating PDF Button */}
      <PDFButton disabled={!hasProducts} />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Product Form - Create Modal */}
      {showForm && (
        <ProductForm
          onSubmit={(data) => { void handleSubmitProduct(data); }}
          onCancel={handleCloseForm}
        />
      )}

      {/* Product Form - Edit Modal */}
      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={(data) => { void handleSaveEdit(data); }}
          onCancel={handleCloseEdit}
        />
      )}

      {/* Footer spacer for mobile */}
      <div className="h-20 sm:h-24" aria-hidden="true" />
    </div>
  );
}

export default App;
