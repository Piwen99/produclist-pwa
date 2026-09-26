import { useEffect, useState } from 'react';
import { QuoteItem } from './QuoteItem';
import { QuoteProductSelector } from './QuoteProductSelector';
import { QuoteShareButton } from './QuoteShareButton';
import { QuotePDFButton } from './QuotePDFButton';
import { saveQuote, getClientNames } from '../db/database';
import { useToast } from '../hooks/useToast';
import type { QuoteItem as QuoteItemType, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';

interface CotizadorProps {
  items: QuoteItemType[];
  totals: QuoteTotals;
  onAddProduct: (product: Product) => void;
  onUpdateQty: (id: string, cantidad: number) => void;
  onUpdatePrecioKg: (id: string, precioKg: number) => void;
  onRemove: (id: string) => void;
}

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Chilean decimal format for kg display
const chileanFormat = (n: number) => n.toFixed(2).replace('.', ',');

export function Cotizador({ items, totals, onAddProduct, onUpdateQty, onUpdatePrecioKg, onRemove }: CotizadorProps) {
  const [showSelector, setShowSelector] = useState(false);
  const [cliente, setCliente] = useState('');
  const [clients, setClients] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    void getClientNames().then(setClients).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.warning('Agregá productos antes de guardar');
      return;
    }
    try {
      const trimmed = cliente.trim();
      await saveQuote({
        items,
        cliente: trimmed === '' ? undefined : trimmed,
        totalNeto: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
      });
      toast.success('Cotización guardada ✅');
    } catch (error) {
      console.error('Error saving quote:', error);
      toast.error('Error al guardar la cotización');
    }
  };

  const handleOpenSelector = () => setShowSelector(true);
  const handleCloseSelector = () => setShowSelector(false);
  const handleSelectProduct = (product: Product) => {
    onAddProduct(product);
    setShowSelector(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cotizador</h2>
        <button
          onClick={handleOpenSelector}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar producto
        </button>
      </div>

      {/* Items list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Agregá productos para comenzar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <QuoteItem
                key={item.id}
                item={item}
                onUpdateQty={(id, qty) => onUpdateQty(id, qty)}
                onUpdatePrecioKg={(id, price) => onUpdatePrecioKg(id, price)}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total kg:</span>
            <span className="text-gray-900 dark:text-white font-medium">{chileanFormat(totals.totalKg)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Subtotal Neto:</span>
            <span className="text-gray-900 dark:text-white font-medium">{clpFormatter.format(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">IVA 19%:</span>
            <span className="text-gray-900 dark:text-white font-medium">{clpFormatter.format(totals.iva)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="text-gray-900 dark:text-white font-semibold">Total a pagar:</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold text-base">{clpFormatter.format(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Share + export actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <QuoteShareButton items={items} totals={totals} />
        <QuotePDFButton
          items={items}
          totals={totals}
          cliente={cliente}
          disabled={items.length === 0}
        />
      </div>

      {/* Client (optional) */}
      <div className="mt-4">
        <label
          htmlFor="quote-client"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Cliente (opcional)
        </label>
        <input
          id="quote-client"
          list="quote-clients"
          type="text"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Nombre del cliente"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <datalist id="quote-clients">
          {clients.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {/* Save button */}
      <div className="mt-2">
        <button
          onClick={() => { void handleSave(); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors touch-manipulation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Guardar cotización
        </button>
      </div>

      {/* Product selector modal */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
            <QuoteProductSelector onSelect={handleSelectProduct} onClose={handleCloseSelector} />
          </div>
        </div>
      )}
    </div>
  );
}