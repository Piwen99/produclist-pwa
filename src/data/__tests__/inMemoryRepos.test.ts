import { describe, it, expect } from 'vitest';
import {
  createInMemoryClientsRepo,
  createInMemoryListSendsRepo,
  createInMemoryProductsRepo,
  createInMemoryQuotesRepo,
  createInMemoryRepositories,
  type Principal,
} from '../testing/inMemoryRepos';
import { OwnershipError } from '../ports';
import type { ProductInput } from '../../types/product';
import type { SavedQuote } from '../../types/quote';
import type { ListSend } from '../../types/listSend';

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

const quoteRow = (over: Partial<SavedQuote> = {}): SavedQuote => ({
  id: 1,
  fecha: new Date('2026-09-01'),
  cliente: 'Cliente',
  items: [],
  totalNeto: 0,
  iva: 0,
  total: 0,
  ownerId: 'vendor-a',
  ...over,
});

const sendRow = (over: Partial<ListSend> = {}): ListSend => ({
  id: 1,
  fecha: new Date('2026-09-01'),
  cliente: 'Cliente',
  items: [],
  ownerId: 'vendor-a',
  ...over,
});

describe('createInMemoryQuotesRepo', () => {
  it('lists only own rows for a non-admin and every owner for an admin (RLS mirror)', async () => {
    const rows = [quoteRow({ id: 1, ownerId: 'vendor-a' }), quoteRow({ id: 2, ownerId: 'vendor-b' })];

    const vendor = createInMemoryQuotesRepo(VENDOR, rows);
    const admin = createInMemoryQuotesRepo(ADMIN, rows);

    expect(await vendor.list()).toHaveLength(1);
    expect(await admin.list()).toHaveLength(2);
  });

  it('returns own rows newest first by fecha', async () => {
    const repo = createInMemoryQuotesRepo(VENDOR, [
      quoteRow({ id: 1, ownerId: 'vendor-a', fecha: new Date('2026-09-01') }),
      quoteRow({ id: 2, ownerId: 'vendor-a', fecha: new Date('2026-09-20') }),
    ]);

    const rows = await repo.listOwn('vendor-a');

    expect(rows.map((row) => row.id)).toEqual([2, 1]);
  });

  it('create attributes the row to the principal and assigns an id', async () => {
    const repo = createInMemoryQuotesRepo(VENDOR);

    const created = await repo.create({
      fecha: new Date('2026-09-01'),
      cliente: 'X',
      items: [],
      totalNeto: 1,
      iva: 0,
      total: 1,
    });

    expect(created.id).toBe(1);
    expect(created.ownerId).toBe('vendor-a');
    expect(await repo.listOwn('vendor-a')).toHaveLength(1);
  });

  it('remove of a foreign or missing row rejects with OwnershipError', async () => {
    const repo = createInMemoryQuotesRepo(ADMIN, [quoteRow({ id: 1, ownerId: 'vendor-b' })]);

    await expect(repo.remove(1)).rejects.toBeInstanceOf(OwnershipError);
    await expect(repo.remove(999)).rejects.toBeInstanceOf(OwnershipError);
  });
});

describe('createInMemoryListSendsRepo', () => {
  it('lists only own rows for a non-admin and every owner for an admin (RLS mirror)', async () => {
    const rows = [sendRow({ id: 1, ownerId: 'vendor-a' }), sendRow({ id: 2, ownerId: 'vendor-b' })];

    const vendor = createInMemoryListSendsRepo(VENDOR, rows);
    const admin = createInMemoryListSendsRepo(ADMIN, rows);

    expect(await vendor.list()).toHaveLength(1);
    expect(await admin.list()).toHaveLength(2);
  });

  it('returns own rows newest first by fecha', async () => {
    const repo = createInMemoryListSendsRepo(VENDOR, [
      sendRow({ id: 1, ownerId: 'vendor-a', fecha: new Date('2026-09-01') }),
      sendRow({ id: 2, ownerId: 'vendor-a', fecha: new Date('2026-09-20') }),
    ]);

    const rows = await repo.listOwn('vendor-a');

    expect(rows.map((row) => row.id)).toEqual([2, 1]);
  });

  it('create attributes the row to the principal and assigns an id', async () => {
    const repo = createInMemoryListSendsRepo(VENDOR);

    const created = await repo.create({
      fecha: new Date('2026-09-01'),
      cliente: 'X',
      items: [],
    });

    expect(created.id).toBe(1);
    expect(created.ownerId).toBe('vendor-a');
  });

  it('remove of a foreign or missing row rejects with OwnershipError', async () => {
    const repo = createInMemoryListSendsRepo(ADMIN, [sendRow({ id: 1, ownerId: 'vendor-b' })]);

    await expect(repo.remove(1)).rejects.toBeInstanceOf(OwnershipError);
    await expect(repo.remove(999)).rejects.toBeInstanceOf(OwnershipError);
  });
});

describe('createInMemoryClientsRepo', () => {
  it('merges the RLS-visible quote and send names, de-duplicated and sorted', async () => {
    const quotes = createInMemoryQuotesRepo(VENDOR, [
      quoteRow({ id: 1, ownerId: 'vendor-a', cliente: '  Juan ' }),
    ]);
    const sends = createInMemoryListSendsRepo(VENDOR, [
      sendRow({ id: 1, ownerId: 'vendor-a', cliente: 'Ana' }),
    ]);

    const clients = createInMemoryClientsRepo(quotes, sends);

    expect(await clients.listNames()).toEqual(['Ana', 'Juan']);
  });

  it('exposes every owner names to an admin but only own names to a vendor', async () => {
    const rows = [
      quoteRow({ id: 1, ownerId: 'admin-1', cliente: 'Admin Client' }),
      quoteRow({ id: 2, ownerId: 'vendor-b', cliente: 'Vendor Client' }),
    ];
    const sends = createInMemoryListSendsRepo(ADMIN, []);

    const adminClients = createInMemoryClientsRepo(
      createInMemoryQuotesRepo(ADMIN, rows),
      sends,
    );
    const vendorClients = createInMemoryClientsRepo(
      createInMemoryQuotesRepo(VENDOR, rows),
      createInMemoryListSendsRepo(VENDOR, []),
    );

    expect(await adminClients.listNames()).toEqual(['Admin Client', 'Vendor Client']);
    expect(await vendorClients.listNames()).toEqual([]);
  });
});

describe('createInMemoryRepositories', () => {
  it('returns the full port set seeded for the principal', async () => {
    const repos = createInMemoryRepositories(VENDOR, [INPUT]);

    const products = await repos.products.list();

    expect(products).toHaveLength(1);
    expect(products[0]?.ownerId).toBe('vendor-a');
    expect(await repos.quotes.listOwn('vendor-a')).toEqual([]);
    expect(await repos.listSends.listOwn('vendor-a')).toEqual([]);
    expect(await repos.clients.listNames()).toEqual([]);
  });
});
