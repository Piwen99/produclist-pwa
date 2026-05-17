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
  // Prevent duplicates by name
  const existing = await db.products.where('nombre').equals(product.nombre).first();
  if (existing) {
    throw new Error(`Ya existe un producto llamado "${product.nombre}"`);
  }

  const id: number = await db.products.add({
    ...product,
    disponible: product.disponible,
  }) as number;
  return id;
}

export async function updateProduct(id: number, changes: Partial<ProductInput>): Promise<void> {
  // If renaming, check the new name doesn't conflict with another product
  if (changes.nombre) {
    const existing = await db.products.where('nombre').equals(changes.nombre).first();
    if (existing && existing.id !== id) {
      throw new Error(`Ya existe un producto llamado "${changes.nombre}"`);
    }
  }
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

/**
 * Remove duplicate products by name, keeping the entry with the lowest ID.
 * Safe to call multiple times (idempotent).
 */
export async function deduplicateProducts(): Promise<number> {
  const allProducts = await db.products.toArray();
  const seen = new Map<string, number[]>();

  for (const p of allProducts) {
    const productId = p.id;
    if (productId === undefined) continue;
    const ids = seen.get(p.nombre) ?? [];
    ids.push(productId);
    seen.set(p.nombre, ids);
  }

  const toDelete: number[] = [];
  for (const [, ids] of seen) {
    if (ids.length > 1) {
      ids.sort((a, b) => a - b);
      toDelete.push(...ids.slice(1));
    }
  }

  if (toDelete.length > 0) {
    await db.products.bulkDelete(toDelete);
    console.log(`[Dedup] Removed ${String(toDelete.length)} duplicate products`);
  }

  return toDelete.length;
}
