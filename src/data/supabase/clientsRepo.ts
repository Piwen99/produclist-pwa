import type { ClientsRepo } from '../ports';
import { mergeClientNames } from '../../utils/clientNames';
import {
  mapPostgrestError,
  rowToListSend,
  rowToSavedQuote,
  type PostgrestErrorLike,
} from './mappers';
import type { ListSendRow, QuoteRow } from './rows';

/** Minimal PostgREST response shape the adapter consumes. */
export interface PostgrestResult<T = unknown> {
  data: T;
  error: PostgrestErrorLike | null;
}

/**
 * Narrow hand-rolled view of the supabase-js `from()` chain. The clients
 * adapter only reads both source tables, owner-scoped, so it exposes `select`
 * and `eq` alone.
 */
export interface ClientsQuery extends PromiseLike<PostgrestResult> {
  select(columns?: string): ClientsQuery;
  eq(column: string, value: unknown): ClientsQuery;
}

export interface ClientsClient {
  from(table: string): ClientsQuery;
}

function toQuoteRows(data: unknown): QuoteRow[] {
  return Array.isArray(data) ? (data as QuoteRow[]) : [];
}

function toListSendRows(data: unknown): ListSendRow[] {
  return Array.isArray(data) ? (data as ListSendRow[]) : [];
}

export function createClientsRepo(client: ClientsClient): ClientsRepo {
  return {
    async listNames(userId) {
      // Owner-scoped across both sources: never a cross-vendor union, so a
      // vendor is not offered a client that only another owner ever used.
      const [quotesResult, sendsResult] = await Promise.all([
        client.from('cotizaciones').select('*').eq('owner_id', userId),
        client.from('listas_enviadas').select('*').eq('owner_id', userId),
      ]);
      if (quotesResult.error) throw mapPostgrestError(quotesResult.error);
      if (sendsResult.error) throw mapPostgrestError(sendsResult.error);

      const quotes = toQuoteRows(quotesResult.data).map(rowToSavedQuote);
      const sends = toListSendRows(sendsResult.data).map(rowToListSend);
      return mergeClientNames(quotes, sends);
    },
  };
}
