import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { QuoteItem, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';
import { tryParseChileanNumber } from '../utils/price';
import { createLocalDraftsRepo } from '../data/local/draftsRepo';

interface UseQuoteReturn {
  items: QuoteItem[];
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateItemQty: (id: string, cantidad: number) => void;
  updateItemPrecioKg: (id: string, precioKg: number) => void;
  clearAll: () => void;
  totals: QuoteTotals;
}

const DRAFT_DEBOUNCE_MS = 800;

export function useQuote(): UseQuoteReturn {
  const [draftsRepo] = useState(createLocalDraftsRepo);
  // Load the stored draft synchronously before the first render, so a refresh
  // restores the cart and there is no window where autosave could clobber it.
  const [items, setItems] = useState<QuoteItem[]>(() => {
    const draft = draftsRepo.load();
    return draft && Array.isArray(draft.items) && draft.items.length > 0 ? draft.items : [];
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<QuoteItem[]>(items);

  // Keep the ref at the latest items for the debounced save timer.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ── Autosave con debounce: cada mutación persiste el borrador ──
  const totals = useMemo<QuoteTotals>(() => {
    let totalKg = 0;
    let subtotal = 0;

    for (const item of items) {
      // Formato inválido → no contribuye al total (null), en vez de un 0
      // silencioso que confundía "0 real" con "inválido" (fix 24-ago-2026).
      const itemKg = (tryParseChileanNumber(item.formato) ?? 0) * item.cantidad;
      totalKg += itemKg;
      subtotal += itemKg * item.precioKg;
    }

    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    return { totalKg, subtotal, iva, total };
  }, [items]);

  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      const draft = {
        items: itemsRef.current,
        totalNeto: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
      };
      try {
        if (draft.items.length === 0) {
          draftsRepo.clear();
        } else {
          draftsRepo.save(draft);
        }
      } catch (error) {
        // localStorage can throw synchronously (quota, private mode); autosave
        // is best-effort and must never crash the cotizador.
        console.error('[useQuote] No se pudo guardar el borrador', error);
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [items, totals, draftsRepo]);

  const addItem = useCallback((product: Product) => {
    if (product.id === undefined) return;
    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      nombre: product.nombre,
      formato: product.formato,
      cantidad: 0,
      precioKg: 0,
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateItemQty = useCallback((id: string, cantidad: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, cantidad: Math.max(0, cantidad) } : item
      )
    );
  }, []);

  const updateItemPrecioKg = useCallback((id: string, precioKg: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, precioKg: Math.max(0, precioKg) } : item
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    addItem,
    removeItem,
    updateItemQty,
    updateItemPrecioKg,
    clearAll,
    totals,
  };
}