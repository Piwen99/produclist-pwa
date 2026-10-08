import type { Product, ProductInput } from '../../types/product';
import { OwnershipError } from '../ports';
import type { ProductInsert, ProductRow } from './rows';

/** Minimal error shape shared by PostgREST responses. */
export interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria as Product['categoria'],
    formato: row.formato,
    precioNeto: row.precio_neto,
    disponible: row.disponible,
    ownerId: row.owner_id,
  };
}

export function productInputToInsert(input: ProductInput, ownerId?: string): ProductInsert {
  return {
    nombre: input.nombre,
    categoria: input.categoria,
    formato: input.formato,
    precio_neto: input.precioNeto,
    disponible: input.disponible,
    ...(ownerId === undefined ? {} : { owner_id: ownerId }),
  };
}

/** Maps a partial product change to a snake_case row patch, omitting absent keys. */
export function productChangesToRow(changes: Partial<ProductInput>): Partial<ProductInsert> {
  const row: Partial<ProductInsert> = {};
  if (changes.nombre !== undefined) row.nombre = changes.nombre;
  if (changes.categoria !== undefined) row.categoria = changes.categoria;
  if (changes.formato !== undefined) row.formato = changes.formato;
  if (changes.precioNeto !== undefined) row.precio_neto = changes.precioNeto;
  if (changes.disponible !== undefined) row.disponible = changes.disponible;
  return row;
}

export function isUniqueViolation(error: PostgrestErrorLike | null | undefined): boolean {
  return error?.code === '23505';
}

export function duplicateProductMessage(nombre: string): string {
  return `Ya existe un producto llamado "${nombre}"`;
}

/**
 * Maps a PostgREST error to a user-facing Error. A `23505` unique violation on
 * `(owner_id, nombre)` becomes the exact Spanish duplicate message; anything
 * else keeps its own message for the existing generic handling.
 */
export function mapPostgrestError(error: PostgrestErrorLike, nombre?: string): Error {
  if (isUniqueViolation(error) && nombre !== undefined) {
    return new Error(duplicateProductMessage(nombre));
  }
  return new Error(error.message ?? 'Error de base de datos.');
}

/** Rejects an UPDATE/DELETE that affected no rows (RLS filtered the target). */
export function assertRowAffected(data: unknown): void {
  if (!Array.isArray(data) || data.length === 0) throw new OwnershipError();
}
