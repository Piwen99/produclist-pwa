import { useData } from '../data/useData';
import type { Product } from '../types/product';

/**
 * Reads the RLS-visible product list from the data cache. `undefined` means the
 * first load has not succeeded yet, so callers can render a skeleton instead of
 * a misleading empty list.
 */
export function useProducts(): Product[] | undefined {
  return useData().products;
}
