import { useCallback } from 'react';
import { useData } from '../data/useData';

export function useDeleteProduct() {
  const data = useData();

  const remove = useCallback(async (id: number): Promise<void> => {
    try {
      await data.deleteProduct(id);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }, [data]);

  return { remove };
}
