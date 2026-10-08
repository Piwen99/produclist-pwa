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
 * adapter only reads both source tables, so it exposes `select` alone.
 */
export interface ClientsQuery extends PromiseLike<PostgrestResult> {
  select(columns?: string): ClientsQuery;
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
    async listNames() {
      // RLS-visible union across both sources: an admin sees every owner's rows.
      const [quotesResult, sendsResult] = await Promise.all([
        client.from('cotizaciones').select('*'),
        client.from('listas_enviadas').select('*'),
      ]);
      if (quotesResult.error) throw mapPostgrestError(quotesResult.error);
      if (sendsResult.error) throw mapPostgrestError(sendsResult.error);

      const quotes = toQuoteRows(quotesResult.data).map(rowToSavedQuote);
      const sends = toListSendRows(sendsResult.data).map(rowToListSend);
      return mergeClientNames(quotes, sends);
    },
  };
}
