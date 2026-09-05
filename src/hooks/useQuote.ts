import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { QuoteItem, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';
import { tryParseChileanNumber } from '../utils/price';
import { saveQuoteDraft, loadQuoteDraft, clearQuoteDraft } from '../db/database';

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
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<QuoteItem[]>(items);
  itemsRef.current = items;

  // ── Cargar borrador guardado al montar (autosave: sobrevive refresh) ──
  useEffect(() => {
    let cancelled = false;
    loadQuoteDraft().then(draft => {
      if (!cancelled && draft && draft.items.length > 0) {
        setItems(draft.items);
      }
      if (!cancelled) {
        setDraftLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!draftLoaded) return; // esperar la carga inicial antes de sobreescribir

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
      if (draft.items.length === 0) {
        clearQuoteDraft().catch(() => {});
      } else {
        saveQuoteDraft(draft).catch(() => {});
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [items, totals, draftLoaded]);

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