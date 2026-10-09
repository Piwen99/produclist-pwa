import type { ProductsRepo } from '../ports';
import {
  assertRowAffected,
  mapPostgrestError,
  productChangesToRow,
  productInputToInsert,
  rowToProduct,
  type PostgrestErrorLike,
} from './mappers';
import type { ProductInsert, ProductRow } from './rows';

/** Minimal PostgREST response shape the adapter consumes. */
export interface PostgrestResult<T = unknown> {
  data: T;
  error: PostgrestErrorLike | null;
  count?: number | null;
}

/**
 * Narrow hand-rolled view of the supabase-js `from()` chain. It exposes only
 * the builder calls the products adapter uses and is thenable, so unit tests
 * can stub the chain without a live Supabase project.
 */
export interface ProductsQuery extends PromiseLike<PostgrestResult> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): ProductsQuery;
  insert(
    values: ProductInsert | ProductInsert[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): ProductsQuery;
  upsert(
    values: ProductInsert | ProductInsert[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): ProductsQuery;
  update(values: Partial<ProductInsert>): ProductsQuery;
  delete(): ProductsQuery;
  eq(column: string, value: unknown): ProductsQuery;
  order(column: string, options?: { ascending?: boolean }): ProductsQuery;
  single(): PromiseLike<PostgrestResult>;
}

export interface ProductsClient {
  from(table: string): ProductsQuery;
}

function toRows(data: unknown): ProductRow[] {
  return Array.isArray(data) ? (data as ProductRow[]) : [];
}

export function createProductsRepo(client: ProductsClient): ProductsRepo {
  return {
    async list() {
      const { data, error } = await client.from('productos').select('*').order('nombre');
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToProduct);
    },

    async listOwn(userId) {
      const { data, error } = await client
        .from('productos')
        .select('*')
        .eq('owner_id', userId)
        .order('nombre');
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToProduct);
    },

    async create(input) {
      const { data, error } = await client
        .from('productos')
        .insert(productInputToInsert(input))
        .select()
        .single();
      if (error) throw mapPostgrestError(error, input.nombre);
      return rowToProduct(data as ProductRow);
    },

    async update(id, changes) {
      const { data, error } = await client
        .from('productos')
        .update(productChangesToRow(changes))
        .eq('id', id)
        .select('id');
      if (error) throw mapPostgrestError(error, changes.nombre);
      assertRowAffected(data);
    },

    async remove(id) {
      const { data, error } = await client
        .from('productos')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw mapPostgrestError(error);
      assertRowAffected(data);
    },

    async seedIfEmpty(userId, seed) {
      // Owner-scoped count: an un-scoped count would see every user's rows
      // through RLS and wrongly skip seeding this owner.
      const { count, error } = await client
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
      if (error) throw mapPostgrestError(error);
      if ((count ?? 0) > 0) return;

      const { error: upsertError } = await client
        .from('productos')
        .upsert(
          seed.map((input) => productInputToInsert(input, userId)),
          { onConflict: 'owner_id,nombre', ignoreDuplicates: true },
        );
      if (upsertError) throw mapPostgrestError(upsertError);
    },
  };
}
