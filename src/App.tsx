import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useProducts } from './hooks/useProducts';
import { useAddProduct } from './hooks/useAddProduct';
import { useUpdateProduct } from './hooks/useUpdateProduct';
import { useDeleteProduct } from './hooks/useDeleteProduct';
import { useQuote } from './hooks/useQuote';
import { clearDraftFor } from './data/local/draftsRepo';
import { useToast } from './hooks/useToast';
import { useAuth } from './auth/useAuth';
import { ChangePasswordDialog } from './auth/ChangePasswordDialog';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { InstallPrompt } from './components/InstallPrompt';
import { Cotizador } from './components/Cotizador';
import { QuoteHistory } from './components/QuoteHistory';
import { ClientPrices } from './components/ClientPrices';
import { ListSends } from './components/ListSends';
import { BottomNav, NAV_ITEMS } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ListSendForm } from './components/ListSendForm';
import { createBackupService, type ImportPreview } from './utils/exportImport';
import { buildListSendItems } from './utils/listSend';
import { useData } from './data/useData';
import type { Product, ProductInput } from './types/product';
import './App.css';

function App() {
  const products = useProducts();
  const { add } = useAddProduct();
  const { update } = useUpdateProduct();
  const { remove } = useDeleteProduct();
  const { toast } = useToast();
  const { signOut, changePassword } = useAuth();
  const { repos, userId, productsError, retryLoad } = useData();
  // Creating a product only makes sense on the catalog route.
  const isProductos = useLocation().pathname === '/';

  const backupService = useMemo(
    () => createBackupService(repos, userId),
    [repos, userId],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showListSendForm, setShowListSendForm] = useState(false);
  const [clientNames, setClientNames] = useState<string[]>([]);

  // Cotizador state
  const { items, addItem, removeItem, updateItemQty, updateItemPrecioKg, clearAll, totals } = useQuote(userId);

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
    void backupService.exportBackup();
  }, [backupService]);

  const handleOpenListSend = useCallback(() => {
    void repos.clients.listNames(userId).then(setClientNames).catch(console.error);
    setShowListSendForm(true);
  }, [repos, userId]);

  const handleSaveListSend = useCallback(async (cliente: string) => {
    setShowListSendForm(false);
    if (!products) return;

    try {
      await repos.listSends.create({ cliente, items: buildListSendItems(products) });
      toast.success(`Lista enviada a ${cliente} guardada.`);
    } catch (error) {
      console.error('Error saving list send:', error);
      toast.error('No se pudo guardar la lista enviada.');
    }
  }, [products, repos, toast]);

  const handleCancelListSend = useCallback(() => {
    setShowListSendForm(false);
  }, []);

  const handleSignOut = useCallback(() => {
    setShowMobileMenu(false);
    // The persisted cart must not survive the session that created it, and a
    // second user on this device must start empty (issue #90).
    clearDraftFor(userId);
    clearAll();
    void signOut().catch((error: unknown) => {
      console.error('Error signing out:', error);
    });
  }, [signOut, userId, clearAll]);

  const handleOpenPasswordDialog = useCallback(() => {
    setShowMobileMenu(false);
    setShowPasswordDialog(true);
  }, []);

  const handleClosePasswordDialog = useCallback(() => {
    setShowPasswordDialog(false);
  }, []);

  const handleChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changePassword(currentPassword, newPassword);
      toast.success('Contraseña actualizada.');
    },
    [changePassword, toast],
  );

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
      const preview = await backupService.previewImport(await file.text());

      if (
        preview.toAdd.length === 0 &&
        preview.toUpdate.length === 0 &&
        preview.quotesToAdd.length === 0 &&
        preview.listSendsToAdd.length === 0
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
  }, [backupService, toast]);

  const handleConfirmImport = useCallback(async () => {
    const preview = importPreview;
    setImportPreview(null);
    if (!preview) return;

    try {
      // Back up the current catalog before overwriting anything, so a wrong or
      // stale file can never destroy the price list irreversibly.
      if (preview.toUpdate.length > 0) {
        await backupService.exportBackup();
      }

      const result = await backupService.applyImport(preview);
      const parts: string[] = [];
      if (result.success > 0) parts.push(`${String(result.success)} agregados`);
      if (result.updated > 0) parts.push(`${String(result.updated)} actualizados`);
      if (result.quotesAdded > 0) parts.push(`${String(result.quotesAdded)} cotizaciones`);
      if (result.listSendsAdded > 0) parts.push(`${String(result.listSendsAdded)} listas enviadas`);
      if (result.errors.length > 0) parts.push(`${String(result.errors.length)} errores`);

      toast.success(`Importación completada: ${parts.join(', ')}.`);
      if (result.errors.length > 0) {
        console.warn('[Import] Errors:', result.errors);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar.');
    }
  }, [importPreview, backupService, toast]);

  const handleCancelImport = useCallback(() => {
    setImportPreview(null);
  }, []);

  const hasProducts = products && products.length > 0;
  const listSendProductCount = products ? buildListSendItems(products).length : 0;

  // Only mention list sends when the file actually carries new ones: an empty
  // count would read as "0 listas enviadas" and clutter the confirmation.
  const listSendsClause =
    importPreview && importPreview.listSendsToAdd.length > 0
      ? ` y ${String(importPreview.listSendsToAdd.length)} listas enviadas`
      : '';

  const importMessage = importPreview
    ? `Se agregarán ${String(importPreview.toAdd.length)}, se actualizarán ${String(importPreview.toUpdate.length)} productos y se sumarán ${String(importPreview.quotesToAdd.length)} cotizaciones${listSendsClause}.`
    : '';

  const importNote =
    importPreview && importPreview.toUpdate.length > 0
      ? 'Se descargará un backup de la lista actual antes de aplicar.'
      : 'Los productos nuevos se agregan sin pisar los existentes.';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              {/* Hamburger menu for export/import */}
              <div className="relative shrink-0" ref={mobileMenuRef}>
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
                    <button
                      onClick={handleOpenPasswordDialog}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                      Cambiar contraseña
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>

              {/* View tabs (desktop) */}
              <nav
                aria-label="Navegación de secciones"
                className="hidden min-w-0 items-center gap-0.5 sm:flex"
              >
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `shrink-0 px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors touch-manipulation ${
                        isActive
                          ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {/* Brand wordmark (mobile only) */}
              <span className="sm:hidden truncate text-sm font-semibold text-gray-900 dark:text-white">
                Produclist
              </span>
            </div>
            {isProductos && (
              <button
                onClick={handleAddNew}
                aria-label="Nuevo producto"
                className="flex shrink-0 items-center gap-1.5 sm:gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nuevo Producto</span>
              </button>
            )}
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
        <Routes>
          <Route index element={
            <ProductList
              products={products}
              loadError={productsError}
              onRetry={retryLoad}
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
          <Route path="clientes" element={<ClientPrices />} />
          <Route path="listas" element={<ListSends />} />
        </Routes>
      </main>

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

      {/* Change the signed-in user's password. Mounted only while open so no
          typed password survives closing the dialog. */}
      {showPasswordDialog && (
        <ChangePasswordDialog
          onClose={handleClosePasswordDialog}
          onSubmit={handleChangePassword}
        />
      )}

      {/* Fixed bottom tab bar (mobile only) */}
      <BottomNav />

      {/* Footer spacer clears the fixed bottom bar + home indicator */}
      <div className="h-[calc(5rem+env(safe-area-inset-bottom))] sm:h-24" aria-hidden="true" />
    </div>
  );
}

export default App;
