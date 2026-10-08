import { useCallback } from 'react';
import { useData } from '../data/useData';
import type { ProductInput } from '../types/product';

export function useUpdateProduct() {
  const data = useData();

  const update = useCallback(async (id: number, changes: Partial<ProductInput>): Promise<void> => {
    try {
      await data.updateProduct(id, changes);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }, [data]);

  return { update };
}
