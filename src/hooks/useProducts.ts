import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Product } from '../types/product';

export function useProducts(): Product[] | undefined {
  return useLiveQuery(
    () => db.products.toArray(),
    []
  );
}

export function useProductsByCategory(category: string): Product[] | undefined {
  return useLiveQuery(
    () => db.products.where('categoria').equals(category).toArray(),
    [category]
  );
}

export function useAvailableProducts(): Product[] | undefined {
  return useLiveQuery(
    () => db.products.where('disponible').equals(1).toArray(),
    []
  );
}
