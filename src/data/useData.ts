import { createContext, useContext } from 'react';
import type { Product, ProductInput } from '../types/product';
import type { Repositories } from './ports';

/**
 * The data seam the hooks consume. The principal (`userId`) is injected by the
 * composition root; this context never reads auth directly.
 */
export interface DataContextValue {
  /**
   * `undefined` until the first successful load. On a failed refresh the last
   * good value is retained, and `productsError` turns `true` so consumers can
   * offer a retry without replacing the cached catalog with a loading or empty
   * state. The next successful refresh clears it.
   */
  products: Product[] | undefined;
  /** `true` while the most recent refresh has failed. Seed failures are logged only; the catalog read decides the screen. */
  productsError: boolean;
  repos: Repositories;
  userId: string;
  refresh: () => Promise<void>;
  /**
   * What the catalog retry action calls: seed the account if it is empty, then
   * read. `refresh` alone cannot recover a failed first seed (issue #91).
   */
  retryLoad: () => Promise<void>;
  addProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: number, changes: Partial<ProductInput>): Promise<void>;
  deleteProduct(id: number): Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
