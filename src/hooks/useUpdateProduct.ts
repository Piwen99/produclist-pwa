import { useCallback } from 'react';
import { updateProduct } from '../db/database';
import type { ProductInput } from '../types/product';

export function useUpdateProduct() {
  const update = useCallback(async (id: number, changes: Partial<ProductInput>): Promise<void> => {
    try {
      await updateProduct(id, changes);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }, []);

  return { update };
}
