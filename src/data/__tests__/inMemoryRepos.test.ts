import { describe, it, expect } from 'vitest';
import {
  createInMemoryProductsRepo,
  createInMemoryRepositories,
  type Principal,
} from '../testing/inMemoryRepos';
import { OwnershipError } from '../ports';
import type { ProductInput } from '../../types/product';

const VENDOR: Principal = { userId: 'vendor-a', isAdmin: false };
const ADMIN: Principal = { userId: 'admin-1', isAdmin: true };

const INPUT: ProductInput = {
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1000,
  disponible: true,
};

const NUECES: ProductInput = { ...INPUT, nombre: 'Nueces' };

describe('createInMemoryProductsRepo', () => {
  it('seeds the principal rows at construction with incremental ids and ownerId', async () => {
    const repo = createInMemoryProductsRepo(VENDOR, [INPUT, NUECES]);

    const rows = await repo.list();

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([1, 2]);
    expect(rows.every((row) => row.ownerId === 'vendor-a')).toBe(true);
  });

  describe('list', () => {
    it('returns only the principal own rows for a non-admin', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      await repo.create(INPUT);
      await repo.seedIfEmpty('other-vendor', [NUECES]);

      const rows = await repo.list();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.nombre).toBe('Almendras');
    });

    it('returns every owner rows for an admin (global read)', async () => {
      const repo = createInMemoryProductsRepo(ADMIN);
      await repo.create(INPUT);
      await repo.seedIfEmpty('vendor-b', [NUECES]);

      const rows = await repo.list();

      expect(rows.map((row) => row.nombre).sort()).toEqual(['Almendras', 'Nueces']);
      expect(rows.map((row) => row.ownerId).sort()).toEqual(['admin-1', 'vendor-b']);
    });
  });

  describe('listOwn', () => {
    it('returns the rows for the requested owner', async () => {
      const repo = createInMemoryProductsRepo(ADMIN);
      await repo.seedIfEmpty('vendor-b', [INPUT]);

      const rows = await repo.listOwn('vendor-b');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.ownerId).toBe('vendor-b');
    });
  });

  describe('create', () => {
    it('assigns ownerId and an incremental id and returns the product', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);

      const created = await repo.create(INPUT);

      expect(created).toEqual({ id: 1, ownerId: 'vendor-a', ...INPUT });
      expect(await repo.listOwn('vendor-a')).toHaveLength(1);
    });

    it('rejects a duplicate name for the same owner with the exact message', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      await repo.create(INPUT);

      await expect(repo.create({ ...INPUT, precioNeto: 5 })).rejects.toThrow(
        'Ya existe un producto llamado "Almendras"',
      );
    });

    it('allows another owner to reuse the same name', async () => {
      const repo = createInMemoryProductsRepo(ADMIN);
      await repo.create(INPUT);

      await repo.seedIfEmpty('vendor-b', [INPUT]);

      expect(await repo.listOwn('vendor-b')).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates an own row', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      const created = await repo.create(INPUT);

      await repo.update(created.id ?? 0, { precioNeto: 999 });

      expect((await repo.list())[0]?.precioNeto).toBe(999);
    });

    it('rejects with OwnershipError for a foreign row', async () => {
      const repo = createInMemoryProductsRepo(ADMIN);
      await repo.seedIfEmpty('vendor-b', [INPUT]);
      const [foreign] = await repo.listOwn('vendor-b');

      await expect(
        repo.update(foreign?.id ?? 0, { precioNeto: 1 }),
      ).rejects.toBeInstanceOf(OwnershipError);
    });

    it('rejects with OwnershipError for a missing row', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);

      await expect(repo.update(999, { precioNeto: 1 })).rejects.toBeInstanceOf(OwnershipError);
    });

    it('rejects an own-name collision', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      const created = await repo.create(INPUT);
      await repo.create(NUECES);

      await expect(repo.update(created.id ?? 0, { nombre: 'Nueces' })).rejects.toThrow(
        'Ya existe un producto llamado "Nueces"',
      );
    });
  });

  describe('remove', () => {
    it('removes an own row', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      const created = await repo.create(INPUT);

      await repo.remove(created.id ?? 0);

      expect(await repo.list()).toHaveLength(0);
    });

    it('rejects with OwnershipError for a foreign row', async () => {
      const repo = createInMemoryProductsRepo(ADMIN);
      await repo.seedIfEmpty('vendor-b', [INPUT]);
      const [foreign] = await repo.listOwn('vendor-b');

      await expect(repo.remove(foreign?.id ?? 0)).rejects.toBeInstanceOf(OwnershipError);
    });

    it('rejects with OwnershipError for a missing row', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);

      await expect(repo.remove(999)).rejects.toBeInstanceOf(OwnershipError);
    });
  });

  describe('seedIfEmpty', () => {
    it('adds the seed rows owned by the user when the owner is empty', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);

      await repo.seedIfEmpty('vendor-a', [INPUT, NUECES]);

      const rows = await repo.listOwn('vendor-a');
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.ownerId === 'vendor-a')).toBe(true);
    });

    it('is a no-op when the owner already has rows', async () => {
      const repo = createInMemoryProductsRepo(VENDOR);
      await repo.create(INPUT);

      await repo.seedIfEmpty('vendor-a', [NUECES]);

      expect(await repo.listOwn('vendor-a')).toHaveLength(1);
    });
  });
});

describe('createInMemoryRepositories', () => {
  it('returns repositories whose products repo is seeded for the principal', async () => {
    const repos = createInMemoryRepositories(VENDOR, [INPUT]);

    const products = await repos.products.list();

    expect(products).toHaveLength(1);
    expect(products[0]?.ownerId).toBe('vendor-a');
  });
});
