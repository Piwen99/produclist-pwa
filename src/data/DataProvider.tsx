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
 * mutation re-reads the owner-scoped set, and a failed read keeps the last good
 * snapshot so the UI never flashes empty on a transient error.
 */
export function DataProvider({ repos, userId, children }: DataProviderProps) {
  const [cache] = useState(createProductsCache);
  const products = useProductsSnapshot(cache);
  const [productsError, setProductsError] = useState(false);
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = refreshSeq.current + 1;
    refreshSeq.current = requestId;
    try {
      // The catalog is a per-user artifact: read the owner-scoped set, never
      // the RLS-visible one. For an admin `list()` also returns every other
      // owner's products (read-only through RLS), which merged other vendors'
      // catalogs into the admin's list and made them undeletable.
      const next = await repos.products.listOwn(userId);
      // Drop a stale response: only the latest in-flight refresh may write.
      if (requestId !== refreshSeq.current) return;
      cache.set(next);
      setProductsError(false);
    } catch (error) {
      console.error('[DataProvider] Failed to refresh products', error);
      // A stale failure must not flag a newer snapshot: only the latest refresh reports.
      if (requestId !== refreshSeq.current) return;
      setProductsError(true);
    }
  }, [repos, cache, userId]);

  const loadProducts = useCallback(async () => {
    let seedFailed = false;
    try {
      await withTimeout(repos.products.seedIfEmpty(userId, seedProducts), SEED_TIMEOUT_MS);
    } catch (error) {
      seedFailed = true;
      console.error('[DataProvider] Failed to seed products', error);
    }

    await refresh();

    // A failed seed on an account with no products used to read as "Sin
    // productos", hiding the failure. Surface it only when the catalog really
    // ended up empty: with rows, the seed failure is just a log.
    const snapshot = cache.getSnapshot();
    if (seedFailed && (snapshot === undefined || snapshot.length === 0)) {
      setProductsError(true);
    }
  }, [repos, userId, refresh, cache]);

  useEffect(() => {
    // `loadProducts` is async and only sets state after its awaits, so this is
    // not a synchronous setState in an effect. The rule cannot see through the
    // callback and would otherwise force a ref indirection for no benefit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
  }, [loadProducts]);

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
    () => ({
      products,
      productsError,
      repos,
      userId,
      refresh,
      retryLoad: loadProducts,
      addProduct,
      updateProduct,
      deleteProduct,
    }),
    [
      products,
      productsError,
      repos,
      userId,
      refresh,
      loadProducts,
      addProduct,
      updateProduct,
      deleteProduct,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
