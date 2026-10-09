import { useCallback, useSyncExternalStore } from 'react';
import type { Product } from '../types/product';

/**
 * Tiny external store over the RLS-visible product list. `undefined` means "not
 * loaded yet", which the UI renders as a skeleton instead of a misleading empty
 * list.
 */
export interface ProductsCache {
  getSnapshot(): Product[] | undefined;
  subscribe(listener: () => void): () => void;
  /** Replaces the snapshot and notifies every subscriber. */
  set(products: Product[]): void;
}

export function createProductsCache(): ProductsCache {
  let snapshot: Product[] | undefined;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (products) => {
      snapshot = products;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * React binding for a products cache. The cache getter is also used as the
 * server snapshot so the first client render stays consistent.
 */
export function useProductsSnapshot(cache: ProductsCache): Product[] | undefined {
  const subscribe = useCallback((listener: () => void) => cache.subscribe(listener), [cache]);
  const getSnapshot = useCallback(() => cache.getSnapshot(), [cache]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
