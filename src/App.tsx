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
import { ConfirmDialog } from './components/ConfirmDialog';
import { BackupReminder } from './components/BackupReminder';
import { ListSendForm } from './components/ListSendForm';
import { exportBackup, previewImport, applyImport, type ImportPreview } from './utils/exportImport';
import { buildListSendItems } from './utils/listSend';
import { saveListSend, getClientNames } from './db/database';
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showListSendForm, setShowListSendForm] = useState(false);
  const [clientNames, setClientNames] = useState<string[]>([]);

  // Cotizador state
  const { items, addItem, removeItem, updateItemQty, updateItemPrecioKg, totals } = useQuote();

  // Close mobile menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMobileMenu]);

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
    void exportBackup(products);
  }, [products]);

  const handleOpenListSend = useCallback(() => {
    void getClientNames().then(setClientNames).catch(console.error);
    setShowListSendForm(true);
  }, []);

  const handleSaveListSend = useCallback(async (cliente: string) => {
    setShowListSendForm(false);
    if (!products) return;

    try {
      await saveListSend({ cliente, items: buildListSendItems(products) });
      toast.success(`Lista enviada a ${cliente} guardada.`);
    } catch (error) {
      console.error('Error saving list send:', error);
      toast.error('No se pudo guardar la lista enviada.');
    }
  }, [products, toast]);

  const handleCancelListSend = useCallback(() => {
    setShowListSendForm(false);
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input early so the same file can be re-selected later.
    e.target.value = '';
    if (!file) return;

    try {
      // Dry-run: validate and match against the catalog WITHOUT writing anything.
      const preview = await previewImport(await file.text());

      if (
        preview.toAdd.length === 0 &&
        preview.toUpdate.length === 0 &&
        preview.quotesToAdd.length === 0
      ) {
        toast.error(
          preview.errors.length > 0
            ? `No se importó nada: ${String(preview.errors.length)} productos con errores.`
            : 'El archivo no contiene productos.'
        );
        if (preview.errors.length > 0) console.warn('[Import] Errors:', preview.errors);
        return;
      }

      // Nothing is written yet — ask for confirmation first.
      setImportPreview(preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar.');
    }
  }, [toast]);

  const handleConfirmImport = useCallback(async () => {
    const preview = importPreview;
    setImportPreview(null);
    if (!preview) return;

    try {
      // Back up the current catalog before overwriting anything, so a wrong or
      // stale file can never destroy the price list irreversibly.
      if (preview.toUpdate.length > 0 && products) {
        await exportBackup(products);
      }

      const result = await applyImport(preview);
      const parts: string[] = [];
      if (result.success > 0) parts.push(`${String(result.success)} agregados`);
      if (result.updated > 0) parts.push(`${String(result.updated)} actualizados`);
      if (result.quotesAdded > 0) parts.push(`${String(result.quotesAdded)} cotizaciones`);
      if (result.errors.length > 0) parts.push(`${String(result.errors.length)} errores`);

      toast.success(`Importación completada: ${parts.join(', ')}.`);
      if (result.errors.length > 0) {
        console.warn('[Import] Errors:', result.errors);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar.');
    }
  }, [importPreview, products, toast]);

  const handleCancelImport = useCallback(() => {
    setImportPreview(null);
  }, []);

  const hasProducts = products && products.length > 0;
  const listSendProductCount = products ? buildListSendItems(products).length : 0;

  const importMessage = importPreview
    ? `Se agregarán ${String(importPreview.toAdd.length)}, se actualizarán ${String(importPreview.toUpdate.length)} productos y se sumarán ${String(importPreview.quotesToAdd.length)} cotizaciones.`
    : '';

  const importNote =
    importPreview && importPreview.toUpdate.length > 0
      ? 'Se descargará un backup de la lista actual antes de aplicar.'
      : 'Los productos nuevos se agregan sin pisar los existentes.';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Hamburger menu for export/import */}
              <div className="relative" ref={mobileMenuRef}>
                <button
                  onClick={() => setShowMobileMenu(v => !v)}
                  className="p-2 text-gray-500 hover:text-orange-500 transition-colors touch-manipulation"
                  aria-label="Menú de opciones"
                  aria-expanded={showMobileMenu}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {showMobileMenu && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <button
                      onClick={() => { handleExportJSON(); setShowMobileMenu(false); }}
                      disabled={!hasProducts}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Exportar JSON
                    </button>
                    <button
                      onClick={() => { handleImportClick(); setShowMobileMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Importar
                    </button>
                    <button
                      onClick={() => { handleOpenListSend(); setShowMobileMenu(false); }}
                      disabled={!hasProducts}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Guardar lista enviada
                    </button>
                  </div>
                )}
              </div>

              {/* View tabs */}
              <nav className="flex items-center">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors touch-manipulation ${
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
                    `px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors touch-manipulation ${
                      isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Cotizador
                </NavLink>
                <NavLink
                  to="/historial"
                  className={({ isActive }) =>
                    `px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors touch-manipulation ${
                      isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Historial
                </NavLink>
              </nav>
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
        {hasProducts && <BackupReminder onExport={handleExportJSON} />}
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

      {/* Import confirmation — nothing is written until this is accepted */}
      <ConfirmDialog
        isOpen={importPreview !== null}
        title="Confirmar importación"
        message={importMessage}
        confirmLabel="Importar"
        note={importNote}
        onConfirm={() => { void handleConfirmImport(); }}
        onCancel={handleCancelImport}
      />

      {/* Save the price list sent to a client */}
      {showListSendForm && (
        <ListSendForm
          productCount={listSendProductCount}
          clients={clientNames}
          onSave={(cliente) => { void handleSaveListSend(cliente); }}
          onCancel={handleCancelListSend}
        />
      )}

      {/* Footer spacer for mobile */}
      <div className="h-20 sm:h-24" aria-hidden="true" />
    </div>
  );
}

export default App;
