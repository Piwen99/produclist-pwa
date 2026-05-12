import Dexie, { type Table } from 'dexie';
import type { Product, ProductInput } from '../types/product';

export class ProduclistDB extends Dexie {
  products!: Table<Product>;

  constructor() {
    super('ProduclistDB');
    this.version(1).stores({
      products: '++id, nombre, categoria, disponible'
    });
  }
}

export const db = new ProduclistDB();

// CRUD Helpers
export async function addProduct(product: ProductInput): Promise<number> {
  return await db.products.add({
    ...product,
    disponible: product.disponible ?? true
  });
}

export async function updateProduct(id: number, changes: Partial<ProductInput>): Promise<void> {
  await db.products.update(id, changes);
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id);
}

export async function getAllProducts(): Promise<Product[]> {
  return await db.products.toArray();
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return await db.products.get(id);
}
