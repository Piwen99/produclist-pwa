import { createContext, useContext } from 'react';
import type { Product, ProductInput } from '../types/product';
import type { Repositories } from './ports';

/**
 * The data seam the hooks consume. The principal (`userId`) is injected by the
 * composition root; this context never reads auth directly.
 */
export interface DataContextValue {
  /** `undefined` until the first successful load; last good value is retained on error. */
  products: Product[] | undefined;
  repos: Repositories;
  userId: string;
  refresh(): Promise<void>;
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
