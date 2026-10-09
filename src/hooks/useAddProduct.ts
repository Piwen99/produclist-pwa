import { useCallback } from 'react';
import { useData } from '../data/useData';
import type { ProductInput } from '../types/product';

export function useAddProduct() {
  const data = useData();

  const add = useCallback(async (product: ProductInput): Promise<number> => {
    try {
      const created = await data.addProduct(product);
      if (created.id === undefined) {
        throw new Error('El producto creado no tiene id.');
      }
      return created.id;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }, [data]);

  return { add };
}
