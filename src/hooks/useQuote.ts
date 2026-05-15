import { useState, useMemo, useCallback } from 'react';
import type { QuoteItem, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';
import { parseChileanNumber } from '../utils/price';

interface UseQuoteReturn {
  items: QuoteItem[];
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateItemQty: (id: string, cantidad: number) => void;
  updateItemPrecioKg: (id: string, precioKg: number) => void;
  clearAll: () => void;
  totals: QuoteTotals;
}

export function useQuote(): UseQuoteReturn {
  const [items, setItems] = useState<QuoteItem[]>([]);

  const addItem = useCallback((product: Product) => {
    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      productId: product.id!,
      nombre: product.nombre,
      formato: product.formato,
      cantidad: 1,
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
        item.id === id ? { ...item, cantidad: Math.max(1, cantidad) } : item
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

  const totals = useMemo<QuoteTotals>(() => {
    let totalKg = 0;
    let subtotal = 0;

    for (const item of items) {
      const itemKg = parseChileanNumber(item.formato) * item.cantidad;
      totalKg += itemKg;
      subtotal += itemKg * item.precioKg;
    }

    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    return { totalKg, subtotal, iva, total };
  }, [items]);

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