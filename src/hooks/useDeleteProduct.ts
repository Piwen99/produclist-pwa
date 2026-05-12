import { useCallback } from 'react';
import { deleteProduct } from '../db/database';

export function useDeleteProduct() {
  const remove = useCallback(async (id: number): Promise<void> => {
    try {
      await deleteProduct(id);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }, []);

  return { remove };
}
