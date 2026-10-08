import type { Product, ProductInput } from '../types/product';

/**
 * Thrown when an UPDATE/DELETE filtered its target row away (0 rows affected).
 * RLS silently filters foreign rows instead of raising, so the adapter turns
 * that empty result into an explicit ownership error.
 */
export class OwnershipError extends Error {
  constructor(message = 'No se puede modificar un registro de otro usuario.') {
    super(message);
    this.name = 'OwnershipError';
  }
}

export interface ProductsRepo {
  /** RLS-visible set: own rows; the admin also sees every other owner's rows. */
  list(): Promise<Product[]>;
  /** Always owner-scoped to the given user id: seed guard, import/export matching. */
  listOwn(userId: string): Promise<Product[]>;
  create(input: ProductInput): Promise<Product>;
  /** Rejects with OwnershipError when RLS filters the target row away (0 rows). */
  update(id: number, changes: Partial<ProductInput>): Promise<void>;
  /** Rejects with OwnershipError when RLS filters the target row away (0 rows). */
  remove(id: number): Promise<void>;
  /** Owner-scoped count; upserts on (owner_id, nombre) with ignoreDuplicates. */
  seedIfEmpty(userId: string, seed: ProductInput[]): Promise<void>;
}

export interface Repositories {
  products: ProductsRepo;
}
