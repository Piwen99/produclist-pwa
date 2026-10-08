import { describe, it, expect, vi } from 'vitest';
import type { PostgrestResult, QuotesClient, QuotesQuery } from '../quotesRepo';
import { createQuotesRepo } from '../quotesRepo';
import { OwnershipError, type QuoteInput } from '../../ports';
import type { QuoteRow } from '../rows';
import type { QuoteItem } from '../../../types/quote';

const ITEMS: QuoteItem[] = [
  { id: 'q1', productId: 1, nombre: 'Almendras', formato: '1', cantidad: 2, precioKg: 1000 },
];

const ROW: QuoteRow = {
  id: 7,
  fecha: '2026-10-08T00:00:00.000Z',
  cliente: 'Juan',
  items: ITEMS,
  total_neto: 2000,
  iva: 380,
  total: 2380,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const MAPPED = {
  id: 7,
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Juan',
  items: ITEMS,
  totalNeto: 2000,
  iva: 380,
  total: 2380,
  ownerId: 'user-1',
};

const INPUT: QuoteInput = {
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Juan',
  items: ITEMS,
  totalNeto: 2000,
  iva: 380,
  total: 2380,
};

/**
 * Hand-rolled stub of the supabase-js `from()` chain: every builder method
 * returns the same thenable query, and each `await` consumes the next queued
 * result. No network, no live Supabase project.
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
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(take())),
    then: (
      onFulfilled: (value: PostgrestResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(take()).then(onFulfilled, onRejected),
  };

  const from = vi.fn(() => query as unknown as QuotesQuery);
  const client = { from } as unknown as QuotesClient;

  return { client, from, query };
}

describe('createQuotesRepo', () => {
  describe('list', () => {
    it('reads the RLS-visible set, newest first, with no owner filter', async () => {
      const { client, from, query } = createStubClient({ data: [ROW], error: null });

      const quotes = await createQuotesRepo(client).list();

      expect(from).toHaveBeenCalledWith('cotizaciones');
      expect(query.select).toHaveBeenCalledWith('*');
      expect(query.order).toHaveBeenCalledWith('fecha', { ascending: false });
      expect(query.eq).not.toHaveBeenCalled();
      expect(quotes).toEqual([MAPPED]);
    });

    it('returns an empty array when there is no data', async () => {
      const { client } = createStubClient({ data: null, error: null });

      expect(await createQuotesRepo(client).list()).toEqual([]);
    });

    it('propagates a query error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'boom' } });

      await expect(createQuotesRepo(client).list()).rejects.toThrow('boom');
    });
  });

  describe('listOwn', () => {
    it('filters by owner_id, newest first, and maps the rows', async () => {
      const { client, query } = createStubClient({ data: [ROW], error: null });

      const quotes = await createQuotesRepo(client).listOwn('user-1');

      expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(query.order).toHaveBeenCalledWith('fecha', { ascending: false });
      expect(quotes).toEqual([MAPPED]);
    });
  });

  describe('create', () => {
    it('inserts one row, selects the single result and returns the mapped quote', async () => {
      const { client, from, query } = createStubClient({ data: ROW, error: null });

      const quote = await createQuotesRepo(client).create(INPUT);

      expect(from).toHaveBeenCalledWith('cotizaciones');
      expect(query.insert).toHaveBeenCalledWith({
        fecha: '2026-10-08T00:00:00.000Z',
        cliente: 'Juan',
        items: ITEMS,
        total_neto: 2000,
        iva: 380,
        total: 2380,
      });
      expect(query.select).toHaveBeenCalled();
      expect(query.single).toHaveBeenCalledTimes(1);
      expect(quote).toEqual(MAPPED);
    });

    it('propagates an insert error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'insert failed' } });

      await expect(createQuotesRepo(client).create(INPUT)).rejects.toThrow('insert failed');
    });
  });

  describe('remove', () => {
    it('deletes the row, selects id and resolves when a row is affected', async () => {
      const { client, query } = createStubClient({ data: [{ id: 7 }], error: null });

      await expect(createQuotesRepo(client).remove(7)).resolves.toBeUndefined();

      expect(query.delete).toHaveBeenCalledTimes(1);
      expect(query.eq).toHaveBeenCalledWith('id', 7);
      expect(query.select).toHaveBeenCalledWith('id');
    });

    it('throws OwnershipError when the delete affects 0 rows', async () => {
      const { client } = createStubClient({ data: [], error: null });

      await expect(createQuotesRepo(client).remove(7)).rejects.toBeInstanceOf(OwnershipError);
    });

    it('propagates a delete error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'delete failed' } });

      await expect(createQuotesRepo(client).remove(7)).rejects.toThrow('delete failed');
    });
  });
});
