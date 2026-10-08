import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createProductsCache, useProductsSnapshot } from './ProductsCache';
import type { Repositories } from './ports';
import { DataContext, type DataContextValue } from './useData';
import type { Product, ProductInput } from '../types/product';

interface DataProviderProps {
  repos: Repositories;
  userId: string;
  children: ReactNode;
}

/**
 * Owns the products cache and exposes the repository seam. Server-first: every
 * mutation re-reads the RLS-visible set, and a failed read keeps the last good
 * snapshot so the UI never flashes empty on a transient error.
 */
export function DataProvider({ repos, userId, children }: DataProviderProps) {
  const [cache] = useState(createProductsCache);
  const products = useProductsSnapshot(cache);

  const refresh = useCallback(async () => {
    try {
      const next = await repos.products.list();
      cache.set(next);
    } catch (error) {
      console.error('[DataProvider] Failed to refresh products', error);
    }
  }, [repos, cache]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
