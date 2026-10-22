import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { QuoteItem, QuoteTotals } from '../types/quote';
import type { Product } from '../types/product';
import { computeQuoteTotals } from '../utils/quoteMath';
import {
  createLocalDraftsRepo,
  draftStorageKey,
  type DraftsRepo,
} from '../data/local/draftsRepo';

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

/** Restore the cart from a draft, tolerating any stored shape. */
function restoreDraft(repo: DraftsRepo): QuoteItem[] {
  const draft = repo.load();
  return draft && Array.isArray(draft.items) && draft.items.length > 0 ? draft.items : [];
}

/**
 * The cart and its draft. `userId` scopes the storage key: without it, one
 * vendor's cart was restored for the next user on the same device (issue #90).
 */
export function useQuote(userId?: string): UseQuoteReturn {
  const draftsRepo = useMemo(
    () => createLocalDraftsRepo(undefined, draftStorageKey(userId)),
    [userId],
  );
  // Load the stored draft synchronously before the first render, so a refresh
  // restores the cart and there is no window where autosave could clobber it.
  const [items, setItems] = useState<QuoteItem[]>(() => restoreDraft(draftsRepo));
  const [draftOwner, setDraftOwner] = useState(userId);

  // A different signed-in user without a remount: swap drafts during render, so
  // the autosave effect can never write the previous user's cart into the new
  // owner's key.
  if (draftOwner !== userId) {
    setDraftOwner(userId);
    setItems(restoreDraft(draftsRepo));
  }

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<QuoteItem[]>(items);

  // Keep the ref at the latest items for the debounced save timer.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ── Totales: una sola implementación (utils/quoteMath) ──
  // Cada línea se redondea al peso y el subtotal suma las líneas redondeadas,
  // para que el documento del cliente cuadre. Un formato inválido no aporta un
  // 0 silencioso: la línea se excluye y se marca como inválida en la UI.
  const totals = useMemo<QuoteTotals>(() => computeQuoteTotals(items), [items]);

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