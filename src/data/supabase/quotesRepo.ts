import type { QuotesRepo } from '../ports';
import {
  assertRowAffected,
  mapPostgrestError,
  quoteInputToInsert,
  rowToSavedQuote,
  type PostgrestErrorLike,
} from './mappers';
import type { QuoteInsert, QuoteRow } from './rows';

/** Minimal PostgREST response shape the adapter consumes. */
export interface PostgrestResult<T = unknown> {
  data: T;
  error: PostgrestErrorLike | null;
  count?: number | null;
}

/**
 * Narrow hand-rolled view of the supabase-js `from()` chain. It exposes only
 * the builder calls the quotes adapter uses and is thenable, so unit tests can
 * stub the chain without a live Supabase project.
 */
export interface QuotesQuery extends PromiseLike<PostgrestResult> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): QuotesQuery;
  insert(values: QuoteInsert | QuoteInsert[]): QuotesQuery;
  delete(): QuotesQuery;
  eq(column: string, value: unknown): QuotesQuery;
  order(column: string, options?: { ascending?: boolean }): QuotesQuery;
  single(): PromiseLike<PostgrestResult>;
}

export interface QuotesClient {
  from(table: string): QuotesQuery;
}

function toRows(data: unknown): QuoteRow[] {
  return Array.isArray(data) ? (data as QuoteRow[]) : [];
}

export function createQuotesRepo(client: QuotesClient): QuotesRepo {
  return {
    async list() {
      const { data, error } = await client
        .from('cotizaciones')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToSavedQuote);
    },

    async listOwn(userId) {
      const { data, error } = await client
        .from('cotizaciones')
        .select('*')
        .eq('owner_id', userId)
        .order('fecha', { ascending: false });
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToSavedQuote);
    },

    async create(data) {
      const { data: row, error } = await client
        .from('cotizaciones')
        .insert(quoteInputToInsert(data))
        .select()
        .single();
      if (error) throw mapPostgrestError(error);
      return rowToSavedQuote(row as QuoteRow);
    },

    async remove(id) {
      const { data, error } = await client
        .from('cotizaciones')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw mapPostgrestError(error);
      assertRowAffected(data);
    },
  };
}
