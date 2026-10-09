import { describe, it, expect, vi } from 'vitest';
import type { PostgrestResult, ListSendsClient, ListSendsQuery } from '../listSendsRepo';
import { createListSendsRepo } from '../listSendsRepo';
import { OwnershipError, type ListSendInput } from '../../ports';
import type { ListSendRow } from '../rows';
import type { ListSendItem } from '../../../types/listSend';

const ITEMS: ListSendItem[] = [
  { nombre: 'Almendras', formato: '11,34', precioNeto: 9200, precioBruto: 10948 },
];

const ROW: ListSendRow = {
  id: 5,
  fecha: '2026-10-08T00:00:00.000Z',
  cliente: 'Ana',
  items: ITEMS,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const MAPPED = {
  id: 5,
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Ana',
  items: ITEMS,
  ownerId: 'user-1',
};

const INPUT: ListSendInput = {
  fecha: new Date('2026-10-08T00:00:00.000Z'),
  cliente: 'Ana',
  items: ITEMS,
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

  const from = vi.fn(() => query as unknown as ListSendsQuery);
  const client = { from } as unknown as ListSendsClient;

  return { client, from, query };
}

describe('createListSendsRepo', () => {
  describe('list', () => {
    it('reads the RLS-visible set, newest first, with no owner filter', async () => {
      const { client, from, query } = createStubClient({ data: [ROW], error: null });

      const sends = await createListSendsRepo(client).list();

      expect(from).toHaveBeenCalledWith('listas_enviadas');
      expect(query.select).toHaveBeenCalledWith('*');
      expect(query.order).toHaveBeenCalledWith('fecha', { ascending: false });
      expect(query.eq).not.toHaveBeenCalled();
      expect(sends).toEqual([MAPPED]);
    });

    it('returns an empty array when there is no data', async () => {
      const { client } = createStubClient({ data: null, error: null });

      expect(await createListSendsRepo(client).list()).toEqual([]);
    });

    it('propagates a query error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'boom' } });

      await expect(createListSendsRepo(client).list()).rejects.toThrow('boom');
    });
  });

  describe('listOwn', () => {
    it('filters by owner_id, newest first, and maps the rows', async () => {
      const { client, query } = createStubClient({ data: [ROW], error: null });

      const sends = await createListSendsRepo(client).listOwn('user-1');

      expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(query.order).toHaveBeenCalledWith('fecha', { ascending: false });
      expect(sends).toEqual([MAPPED]);
    });
  });

  describe('create', () => {
    it('inserts one row, selects the single result and returns the mapped list send', async () => {
      const { client, from, query } = createStubClient({ data: ROW, error: null });

      const send = await createListSendsRepo(client).create(INPUT);

      expect(from).toHaveBeenCalledWith('listas_enviadas');
      expect(query.insert).toHaveBeenCalledWith({
        fecha: '2026-10-08T00:00:00.000Z',
        cliente: 'Ana',
        items: ITEMS,
      });
      expect(query.select).toHaveBeenCalled();
      expect(query.single).toHaveBeenCalledTimes(1);
      expect(send).toEqual(MAPPED);
    });

    it('propagates an insert error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'insert failed' } });

      await expect(createListSendsRepo(client).create(INPUT)).rejects.toThrow('insert failed');
    });
  });

  describe('remove', () => {
    it('deletes the row, selects id and resolves when a row is affected', async () => {
      const { client, query } = createStubClient({ data: [{ id: 5 }], error: null });

      await expect(createListSendsRepo(client).remove(5)).resolves.toBeUndefined();

      expect(query.delete).toHaveBeenCalledTimes(1);
      expect(query.eq).toHaveBeenCalledWith('id', 5);
      expect(query.select).toHaveBeenCalledWith('id');
    });

    it('throws OwnershipError when the delete affects 0 rows', async () => {
      const { client } = createStubClient({ data: [], error: null });

      await expect(createListSendsRepo(client).remove(5)).rejects.toBeInstanceOf(OwnershipError);
    });

    it('propagates a delete error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'delete failed' } });

      await expect(createListSendsRepo(client).remove(5)).rejects.toThrow('delete failed');
    });
  });
});
