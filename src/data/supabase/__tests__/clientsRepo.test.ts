import { describe, it, expect, vi } from 'vitest';
import type { PostgrestResult, ClientsClient, ClientsQuery } from '../clientsRepo';
import { createClientsRepo } from '../clientsRepo';
import type { QuoteRow, ListSendRow } from '../rows';

const QUOTE_ROW: QuoteRow = {
  id: 1,
  fecha: '2026-10-01T00:00:00.000Z',
  cliente: 'Ana',
  items: [],
  total_neto: 0,
  iva: 0,
  total: 0,
  owner_id: 'admin-1',
  created_at: '2026-10-01T00:00:00.000Z',
};

const OTHER_OWNER_QUOTE_ROW: QuoteRow = {
  ...QUOTE_ROW,
  id: 2,
  cliente: 'juan',
  owner_id: 'user-2',
};

const SEND_ROW: ListSendRow = {
  id: 1,
  fecha: '2026-10-02T00:00:00.000Z',
  cliente: 'JUAN',
  items: [],
  owner_id: 'admin-1',
  created_at: '2026-10-02T00:00:00.000Z',
};

const OTHER_SEND_ROW: ListSendRow = {
  ...SEND_ROW,
  id: 2,
  cliente: 'Betá',
  owner_id: 'user-2',
};

/**
 * Hand-rolled stub of the supabase-js `from()` chain returning the same
 * thenable query for every table and consuming queued results in await order
 * (the quotes query resolves before the list-sends query in `Promise.all`).
 */
function createStubClient(...results: PostgrestResult[]) {
  const queue = [...results];
  let last: PostgrestResult = results[0] ?? { data: [], error: null };

  const take = (): PostgrestResult => {
    const queued = queue.shift();
    if (queued) {
      last = queued;
      return queued;
    }
    return last;
  };

  const query = {
    select: vi.fn(() => query),
    then: (
      onFulfilled: (value: PostgrestResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(take()).then(onFulfilled, onRejected),
  };

  const from = vi.fn(() => query as unknown as ClientsQuery);
  const client = { from } as unknown as ClientsClient;

  return { client, from, query };
}

describe('createClientsRepo', () => {
  describe('listNames', () => {
    it('reads both tables and merges their client names', async () => {
      const { client, from } = createStubClient(
        { data: [QUOTE_ROW], error: null },
        { data: [SEND_ROW], error: null },
      );

      expect(await createClientsRepo(client).listNames()).toEqual(['Ana', 'JUAN']);

      expect(from).toHaveBeenNthCalledWith(1, 'cotizaciones');
      expect(from).toHaveBeenNthCalledWith(2, 'listas_enviadas');
    });

    it('dedupes case-insensitively keeping the quote casing (quotes first)', async () => {
      const { client } = createStubClient(
        { data: [OTHER_OWNER_QUOTE_ROW], error: null },
        { data: [SEND_ROW], error: null },
      );

      expect(await createClientsRepo(client).listNames()).toEqual(['juan']);
    });

    it('reflects the RLS-visible set (admin union across owners)', async () => {
      const { client } = createStubClient(
        { data: [QUOTE_ROW, OTHER_OWNER_QUOTE_ROW], error: null },
        { data: [SEND_ROW, OTHER_SEND_ROW], error: null },
      );

      expect(await createClientsRepo(client).listNames()).toEqual(['Ana', 'Betá', 'juan']);
    });

    it('returns an empty array when both tables are empty', async () => {
      const { client } = createStubClient(
        { data: [], error: null },
        { data: [], error: null },
      );

      expect(await createClientsRepo(client).listNames()).toEqual([]);
    });

    it('propagates a quotes query error', async () => {
      const { client } = createStubClient(
        { data: null, error: { message: 'quotes boom' } },
        { data: [], error: null },
      );

      await expect(createClientsRepo(client).listNames()).rejects.toThrow('quotes boom');
    });

    it('propagates a list-sends query error', async () => {
      const { client } = createStubClient(
        { data: [], error: null },
        { data: null, error: { message: 'sends boom' } },
      );

      await expect(createClientsRepo(client).listNames()).rejects.toThrow('sends boom');
    });
  });
});
