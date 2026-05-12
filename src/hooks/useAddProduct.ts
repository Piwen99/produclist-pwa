import { useCallback } from 'react';
import { addProduct } from '../db/database';
import type { ProductInput } from '../types/product';

export function useAddProduct() {
  const add = useCallback(async (product: ProductInput): Promise<number> => {
    try {
      const id = await addProduct(product);
      return id;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }, []);

  return { add };
}
