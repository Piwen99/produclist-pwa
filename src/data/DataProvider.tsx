import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createProductsCache, useProductsSnapshot } from './ProductsCache';
import type { Repositories } from './ports';
import { DataContext, type DataContextValue } from './useData';
import { seedProducts } from './seedProducts';
import type { Product, ProductInput } from '../types/product';

interface DataProviderProps {
  repos: Repositories;
  userId: string;
  children: ReactNode;
}

/** Upper bound on the mount seed so a hung seed cannot block the first load. */
export const SEED_TIMEOUT_MS = 10_000;

/**
 * Race `promise` against a timer. The timer is cleared in a `finally` so a
 * successful (or rejected) seed leaves no dangling rejection behind.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Seed timed out after ${String(ms)}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Owns the products cache and exposes the repository seam. Server-first: every
 * mutation re-reads the RLS-visible set, and a failed read keeps the last good
 * snapshot so the UI never flashes empty on a transient error.
 */
export function DataProvider({ repos, userId, children }: DataProviderProps) {
  const [cache] = useState(createProductsCache);
  const products = useProductsSnapshot(cache);
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = refreshSeq.current + 1;
    refreshSeq.current = requestId;
    try {
      const next = await repos.products.list();
      // Drop a stale response: only the latest in-flight refresh may write.
      if (requestId !== refreshSeq.current) return;
      cache.set(next);
    } catch (error) {
      console.error('[DataProvider] Failed to refresh products', error);
    }
  }, [repos, cache]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        await withTimeout(repos.products.seedIfEmpty(userId, seedProducts), SEED_TIMEOUT_MS);
      } catch (error) {
        console.error('[DataProvider] Failed to seed products', error);
      }
      if (!active) return;
      await refresh();
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [repos, userId, refresh]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const handleOnline = () => {
      void refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [refresh]);

  const addProduct = useCallback(
    async (input: ProductInput): Promise<Product> => {
      const created = await repos.products.create(input);
      await refresh();
      return created;
    },
    [repos, refresh],
  );

  const updateProduct = useCallback(
    async (id: number, changes: Partial<ProductInput>): Promise<void> => {
      await repos.products.update(id, changes);
      await refresh();
    },
    [repos, refresh],
  );

  const deleteProduct = useCallback(
    async (id: number): Promise<void> => {
      await repos.products.remove(id);
      await refresh();
    },
    [repos, refresh],
  );

  const value = useMemo<DataContextValue>(
    () => ({ products, repos, userId, refresh, addProduct, updateProduct, deleteProduct }),
    [products, repos, userId, refresh, addProduct, updateProduct, deleteProduct],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
