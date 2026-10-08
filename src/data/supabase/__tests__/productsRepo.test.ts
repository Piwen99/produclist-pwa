import { describe, it, expect, vi } from 'vitest';
import type { PostgrestResult, ProductsClient, ProductsQuery } from '../productsRepo';
import { createProductsRepo } from '../productsRepo';
import { OwnershipError } from '../../ports';
import type { ProductRow } from '../rows';
import type { ProductInput } from '../../../types/product';

const ROW: ProductRow = {
  id: 7,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precio_neto: 1200,
  disponible: true,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const MAPPED = {
  id: 7,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1200,
  disponible: true,
  ownerId: 'user-1',
};

const INPUT: ProductInput = {
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1200,
  disponible: true,
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
    upsert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(take())),
    then: (onFulfilled: (value: PostgrestResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(take()).then(onFulfilled, onRejected),
  };

  const from = vi.fn(() => query as unknown as ProductsQuery);
  const client = { from } as unknown as ProductsClient;

  return { client, from, query };
}

describe('createProductsRepo', () => {
  describe('list', () => {
    it('reads the RLS-visible set with no owner filter, ordered by nombre', async () => {
      const { client, from, query } = createStubClient({ data: [ROW], error: null });

      const products = await createProductsRepo(client).list();

      expect(from).toHaveBeenCalledWith('productos');
      expect(query.select).toHaveBeenCalledWith('*');
      expect(query.order).toHaveBeenCalledWith('nombre');
      expect(query.eq).not.toHaveBeenCalled();
      expect(products).toEqual([MAPPED]);
    });

    it('returns an empty array when there is no data', async () => {
      const { client } = createStubClient({ data: null, error: null });

      expect(await createProductsRepo(client).list()).toEqual([]);
    });

    it('propagates a query error', async () => {
      const { client } = createStubClient({ data: null, error: { message: 'boom' } });

      await expect(createProductsRepo(client).list()).rejects.toThrow('boom');
    });
  });

  describe('listOwn', () => {
    it('filters by owner_id and maps the rows', async () => {
      const { client, query } = createStubClient({ data: [ROW], error: null });

      const products = await createProductsRepo(client).listOwn('user-1');

      expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(query.order).toHaveBeenCalledWith('nombre');
      expect(products).toEqual([MAPPED]);
    });
  });

  describe('create', () => {
    it('inserts one row, selects the single result and returns the mapped product', async () => {
      const { client, from, query } = createStubClient({ data: ROW, error: null });

      const product = await createProductsRepo(client).create(INPUT);

      expect(from).toHaveBeenCalledWith('productos');
      expect(query.insert).toHaveBeenCalledWith({
        nombre: 'Almendras',
        categoria: 'Frutos Secos',
        formato: '1',
        precio_neto: 1200,
        disponible: true,
      });
      expect(query.select).toHaveBeenCalled();
      expect(query.single).toHaveBeenCalledTimes(1);
      expect(product).toEqual(MAPPED);
    });

    it('maps a 23505 unique violation to the exact duplicate-name message', async () => {
      const { client } = createStubClient({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      await expect(createProductsRepo(client).create(INPUT)).rejects.toThrow(
        'Ya existe un producto llamado "Almendras"',
      );
    });
  });

  describe('update', () => {
    it('updates the row, selects id and resolves when a row is affected', async () => {
      const { client, query } = createStubClient({ data: [{ id: 7 }], error: null });

      await expect(
        createProductsRepo(client).update(7, { precioNeto: 1500, disponible: false }),
      ).resolves.toBeUndefined();

      expect(query.update).toHaveBeenCalledWith({ precio_neto: 1500, disponible: false });
      expect(query.eq).toHaveBeenCalledWith('id', 7);
      expect(query.select).toHaveBeenCalledWith('id');
    });

    it('throws OwnershipError when the update affects 0 rows', async () => {
      const { client } = createStubClient({ data: [], error: null });

      await expect(createProductsRepo(client).update(7, { precioNeto: 1500 })).rejects.toBeInstanceOf(
        OwnershipError,
      );
    });
  });

  describe('remove', () => {
    it('deletes the row, selects id and resolves when a row is affected', async () => {
      const { client, query } = createStubClient({ data: [{ id: 7 }], error: null });

      await expect(createProductsRepo(client).remove(7)).resolves.toBeUndefined();

      expect(query.delete).toHaveBeenCalledTimes(1);
      expect(query.eq).toHaveBeenCalledWith('id', 7);
      expect(query.select).toHaveBeenCalledWith('id');
    });

    it('throws OwnershipError when the delete affects 0 rows', async () => {
      const { client } = createStubClient({ data: [], error: null });

      await expect(createProductsRepo(client).remove(7)).rejects.toBeInstanceOf(OwnershipError);
    });
  });

  describe('seedIfEmpty', () => {
    it('counts own rows and skips the upsert when the owner already has data', async () => {
      const { client, query } = createStubClient({ data: null, count: 3, error: null });

      await createProductsRepo(client).seedIfEmpty('user-1', [INPUT]);

      expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(query.upsert).not.toHaveBeenCalled();
    });

    it('upserts owner-scoped seed rows with ignoreDuplicates when empty', async () => {
      const { client, query } = createStubClient(
        { data: null, count: 0, error: null },
        { data: null, error: null },
      );

      await createProductsRepo(client).seedIfEmpty('user-1', [INPUT]);

      expect(query.upsert).toHaveBeenCalledWith(
        [
          {
            owner_id: 'user-1',
            nombre: 'Almendras',
            categoria: 'Frutos Secos',
            formato: '1',
            precio_neto: 1200,
            disponible: true,
          },
        ],
        { onConflict: 'owner_id,nombre', ignoreDuplicates: true },
      );
    });

    it('treats a null count as empty', async () => {
      const { client, query } = createStubClient(
        { data: null, count: null, error: null },
        { data: null, error: null },
      );

      await createProductsRepo(client).seedIfEmpty('user-1', [INPUT]);

      expect(query.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
