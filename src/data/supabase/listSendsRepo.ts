import type { ListSendsRepo } from '../ports';
import {
  assertRowAffected,
  listSendInputToInsert,
  mapPostgrestError,
  rowToListSend,
  type PostgrestErrorLike,
} from './mappers';
import type { ListSendInsert, ListSendRow } from './rows';

/** Minimal PostgREST response shape the adapter consumes. */
export interface PostgrestResult<T = unknown> {
  data: T;
  error: PostgrestErrorLike | null;
  count?: number | null;
}

/**
 * Narrow hand-rolled view of the supabase-js `from()` chain. It exposes only
 * the builder calls the list-sends adapter uses and is thenable, so unit tests
 * can stub the chain without a live Supabase project.
 */
export interface ListSendsQuery extends PromiseLike<PostgrestResult> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): ListSendsQuery;
  insert(values: ListSendInsert | ListSendInsert[]): ListSendsQuery;
  delete(): ListSendsQuery;
  eq(column: string, value: unknown): ListSendsQuery;
  order(column: string, options?: { ascending?: boolean }): ListSendsQuery;
  single(): PromiseLike<PostgrestResult>;
}

export interface ListSendsClient {
  from(table: string): ListSendsQuery;
}

function toRows(data: unknown): ListSendRow[] {
  return Array.isArray(data) ? (data as ListSendRow[]) : [];
}

export function createListSendsRepo(client: ListSendsClient): ListSendsRepo {
  return {
    async list() {
      const { data, error } = await client
        .from('listas_enviadas')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToListSend);
    },

    async listOwn(userId) {
      const { data, error } = await client
        .from('listas_enviadas')
        .select('*')
        .eq('owner_id', userId)
        .order('fecha', { ascending: false });
      if (error) throw mapPostgrestError(error);
      return toRows(data).map(rowToListSend);
    },

    async create(data) {
      const { data: row, error } = await client
        .from('listas_enviadas')
        .insert(listSendInputToInsert(data))
        .select()
        .single();
      if (error) throw mapPostgrestError(error);
      return rowToListSend(row as ListSendRow);
    },

    async remove(id) {
      const { data, error } = await client
        .from('listas_enviadas')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw mapPostgrestError(error);
      assertRowAffected(data);
    },
  };
}
