import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseProductImport,
  listSendSignature,
  createBackupService,
  BACKUP_VERSION,
  type BackupFile,
  type BackupService,
  type ImportPreview,
} from '../exportImport';
import {
  createInMemoryClientsRepo,
  createInMemoryListSendsRepo,
  createInMemoryProductsRepo,
  createInMemoryQuotesRepo,
  createInMemoryRepositories,
  type Principal,
} from '../../data/testing/inMemoryRepos';
import type { Repositories } from '../../data/ports';
import type { ProductInput } from '../../types/product';

const validProduct: ProductInput = {
  nombre: 'ALMENDRA LAMINADA',
  categoria: 'Frutos Secos',
  formato: '11,34',
  precioNeto: 9200,
  disponible: true,
};

describe('parseProductImport', () => {
  it('accepts a valid array', () => {
    const { valid, errors } = parseProductImport(JSON.stringify([validProduct]));
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0].nombre).toBe('ALMENDRA LAMINADA');
  });

  it('rejects a whitespace-only name instead of importing an empty product', () => {
    const { valid, errors } = parseProductImport(
      JSON.stringify([{ ...validProduct, nombre: '   ' }])
    );
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toMatch(/nombre/i);
  });

  it('rejects a negative price', () => {
    const { valid, errors } = parseProductImport(
      JSON.stringify([{ ...validProduct, precioNeto: -5 }])
    );
    expect(valid).toHaveLength(0);
    expect(errors[0].error).toMatch(/precio/i);
  });

  it('rejects a non-numeric price', () => {
    const { valid } = parseProductImport(
      JSON.stringify([{ ...validProduct, precioNeto: 'abc' }])
    );
    expect(valid).toHaveLength(0);
  });

  it('rejects an unknown category', () => {
    const { valid } = parseProductImport(
      JSON.stringify([{ ...validProduct, categoria: 'Otra' }])
    );
    expect(valid).toHaveLength(0);
  });

  it('rejects an invalid formato', () => {
    const { valid } = parseProductImport(
      JSON.stringify([{ ...validProduct, formato: '11.34' }])
    );
    expect(valid).toHaveLength(0);
  });

  it('throws when the file is not JSON or not an array', () => {
    expect(() => parseProductImport('not json')).toThrow(/JSON/i);
    expect(() => parseProductImport('{"a":1}')).toThrow(/arreglo/i);
  });
});

const sampleQuote = {
  fecha: new Date('2026-09-20T10:00:00.000Z'),
  items: [
    {
      id: 'item-1',
      productId: 1,
      nombre: 'ALMENDRA LAMINADA',
      formato: '11,34',
      cantidad: 2,
      precioKg: 9200,
    },
  ],
  totalNeto: 18400,
  iva: 3496,
  total: 21896,
};

const sampleSend = {
  fecha: new Date('2026-09-22T10:00:00.000Z'),
  cliente: '  Acme SpA ',
  items: [
    {
      nombre: 'ALMENDRA LAMINADA',
      formato: '11,34',
      precioNeto: 9200,
      precioBruto: 10948,
    },
  ],
};

const backupV2 = (products: unknown[], quotes: unknown[]) =>
  JSON.stringify({
    version: 2,
    exportedAt: '2026-09-25T12:00:00.000Z',
    products,
    quotes,
  });

const backupV3 = (products: unknown[], quotes: unknown[], listSends: unknown[]) =>
  JSON.stringify({
    version: 3,
    exportedAt: '2026-10-05T12:00:00.000Z',
    products,
    quotes,
    listSends,
  });

const emptyPreview = (overrides: Partial<ImportPreview>): ImportPreview => ({
  toAdd: [],
  toUpdate: [],
  quotesToAdd: [],
  listSendsToAdd: [],
  errors: [],
  ...overrides,
});

describe('listSendSignature', () => {
  it('normalizes fecha to ISO and cliente to trimmed + lowercased', () => {
    expect(listSendSignature(sampleSend)).toBe(
      JSON.stringify({
        fecha: '2026-09-22T10:00:00.000Z',
        cliente: 'acme spa',
        items: [
          {
            nombre: 'ALMENDRA LAMINADA',
            formato: '11,34',
            precioNeto: 9200,
            precioBruto: 10948,
          },
        ],
      })
    );
  });

  it('ignores the id: the same send with a different id shares a signature', () => {
    expect(listSendSignature({ ...sampleSend, id: 1 })).toBe(
      listSendSignature({ ...sampleSend, id: 999 })
    );
  });
});

describe('backup format compatibility', () => {
  it('writes version 3', () => {
    expect(BACKUP_VERSION).toBe(3);
  });

  it('parses quotes from a v2 backup', () => {
    const { valid, quotes, errors } = parseProductImport(
      backupV2([validProduct], [sampleQuote])
    );
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].items).toHaveLength(1);
  });

  it('still accepts a legacy v1 bare array (products only)', () => {
    const { valid, quotes, listSends } = parseProductImport(JSON.stringify([validProduct]));
    expect(valid).toHaveLength(1);
    expect(quotes).toHaveLength(0);
    expect(listSends).toHaveLength(0);
  });

  it('defaults listSends to [] for a v2 backup (no listSends field)', () => {
    const { listSends } = parseProductImport(backupV2([validProduct], [sampleQuote]));
    expect(listSends).toHaveLength(0);
  });

  it('parses list sends from a v3 backup', () => {
    const { listSends, errors } = parseProductImport(
      backupV3([validProduct], [sampleQuote], [sampleSend])
    );
    expect(errors).toHaveLength(0);
    expect(listSends).toHaveLength(1);
    expect(listSends[0].cliente).toBe('  Acme SpA ');
    expect(listSends[0].items[0].nombre).toBe('ALMENDRA LAMINADA');
  });
});

describe('createBackupService (owner-scoped preview/apply)', () => {
  const PRINCIPAL: Principal = { userId: 'user-1', isAdmin: false };
  let repos: Repositories;
  let service: BackupService;

  beforeEach(() => {
    repos = createInMemoryRepositories(PRINCIPAL);
    service = createBackupService(repos, PRINCIPAL.userId);
  });

  describe('products', () => {
    it('preview writes nothing and separates adds from updates', async () => {
      await repos.products.create(validProduct);
      const text = JSON.stringify([
        { ...validProduct, precioNeto: 9900 },
        { ...validProduct, nombre: 'NUEZ NUEVA', precioNeto: 5000 },
      ]);

      const preview = await service.previewImport(text);
      expect(preview.toUpdate).toHaveLength(1);
      expect(preview.toAdd).toHaveLength(1);

      // The dry-run must not have touched the catalog
      const afterPreview = await repos.products.listOwn(PRINCIPAL.userId);
      expect(afterPreview).toHaveLength(1);
      expect(afterPreview[0].precioNeto).toBe(9200);
    });

    it('applyImport writes the adds and the updates', async () => {
      await repos.products.create(validProduct);
      const preview = await service.previewImport(
        JSON.stringify([
          { ...validProduct, precioNeto: 9900 },
          { ...validProduct, nombre: 'NUEZ NUEVA', precioNeto: 5000 },
        ])
      );

      const result = await service.applyImport(preview);
      expect(result.updated).toBe(1);
      expect(result.success).toBe(1);

      const all = await repos.products.listOwn(PRINCIPAL.userId);
      expect(all).toHaveLength(2);
      expect(all.find((p) => p.nombre === 'ALMENDRA LAMINADA')?.precioNeto).toBe(9900);
      expect(all.find((p) => p.nombre === 'NUEZ NUEVA')?.precioNeto).toBe(5000);
    });

    it('applyImport reports parse errors alongside the applied changes', async () => {
      const preview = await service.previewImport(
        JSON.stringify([validProduct, { ...validProduct, nombre: '  ', precioNeto: 10 }])
      );
      const result = await service.applyImport(preview);
      expect(result.success).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('quotes', () => {
    it('adds a quote that this device does not have yet', async () => {
      const preview = await service.previewImport(backupV2([], [sampleQuote]));
      expect(preview.quotesToAdd).toHaveLength(1);

      const result = await service.applyImport(preview);
      expect(result.quotesAdded).toBe(1);

      const stored = await repos.quotes.listOwn(PRINCIPAL.userId);
      expect(stored).toHaveLength(1);
      expect(stored[0].total).toBe(21896);
    });

    it('does not duplicate a quote the device already has (merge by content)', async () => {
      await service.applyImport(await service.previewImport(backupV2([], [sampleQuote])));

      // Same quote again, even with a different id: content match must skip it.
      const second = await service.previewImport(backupV2([], [{ ...sampleQuote, id: 999 }]));
      expect(second.quotesToAdd).toHaveLength(0);
      expect(await repos.quotes.listOwn(PRINCIPAL.userId)).toHaveLength(1);
    });

    it('preview writes no quotes either', async () => {
      await service.previewImport(backupV2([], [sampleQuote]));
      expect(await repos.quotes.listOwn(PRINCIPAL.userId)).toHaveLength(0);
    });

    it('continues past a failing quote so later quotes still persist', async () => {
      const quotes = [1, 2, 3].map((n) => ({
        ...sampleQuote,
        fecha: new Date(`2026-09-2${n}T10:00:00.000Z`),
        cliente: `Cliente ${n}`,
        totalNeto: sampleQuote.totalNeto + n,
        total: sampleQuote.total + n,
      }));
      const preview = await service.previewImport(backupV2([], quotes));
      expect(preview.quotesToAdd).toHaveLength(3);

      const realCreate = repos.quotes.create.bind(repos.quotes);
      let calls = 0;
      repos.quotes.create = (data) => {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error('quote write failed'));
        return realCreate(data);
      };

      const result = await service.applyImport(preview);

      expect(result.quotesAdded).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nombre).toBe('(cotización del 2026-09-22)');
      expect(result.errors[0].error).toBe('quote write failed');
      expect(await repos.quotes.listOwn(PRINCIPAL.userId)).toHaveLength(2);
    });

    it('labels a failed quote with the local calendar day, not the UTC day', async () => {
      const originalTz = process.env.TZ;
      process.env.TZ = 'Etc/GMT+4'; // UTC-4, no DST: 02:00Z is the previous local day.
      try {
        const quote = { ...sampleQuote, fecha: new Date('2026-09-23T02:00:00.000Z') };
        expect(quote.fecha.toISOString().slice(0, 10)).toBe('2026-09-23');

        repos.quotes.create = () => Promise.reject(new Error('quote write failed'));
        const result = await service.applyImport(emptyPreview({ quotesToAdd: [quote] }));

        expect(result.quotesAdded).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].nombre).toBe('(cotización del 2026-09-22)');
      } finally {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
      }
    });

    it('reports a mid-batch quote with an invalid date as a generic label and keeps later quotes', async () => {
      const quotes = [
        { ...sampleQuote, fecha: new Date('2026-09-21T10:00:00.000Z'), cliente: 'Uno' },
        { ...sampleQuote, fecha: new Date('not-a-date'), cliente: 'Rota' },
        { ...sampleQuote, fecha: new Date('2026-09-23T10:00:00.000Z'), cliente: 'Tres' },
      ];
      const realCreate = repos.quotes.create.bind(repos.quotes);
      let calls = 0;
      repos.quotes.create = (data) => {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error('quote write failed'));
        return realCreate(data);
      };

      const result = await service.applyImport(emptyPreview({ quotesToAdd: quotes }));

      expect(result.quotesAdded).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nombre).toBe('(cotización)');
      expect(await repos.quotes.listOwn(PRINCIPAL.userId)).toHaveLength(2);
    });
  });

  describe('list sends', () => {
    it('previews and applies unseen list sends', async () => {
      const preview = await service.previewImport(backupV3([], [], [sampleSend]));
      expect(preview.listSendsToAdd).toHaveLength(1);

      const result = await service.applyImport(preview);
      expect(result.listSendsAdded).toBe(1);

      const stored = await repos.listSends.listOwn(PRINCIPAL.userId);
      expect(stored).toHaveLength(1);
      expect(stored[0].cliente).toBe('  Acme SpA ');
      expect(stored[0].items[0].precioBruto).toBe(10948);
    });

    it('re-importing the same v3 file is a no-op (idempotent)', async () => {
      await service.applyImport(await service.previewImport(backupV3([], [], [sampleSend])));

      const second = await service.previewImport(backupV3([], [], [sampleSend]));
      expect(second.listSendsToAdd).toHaveLength(0);

      const result = await service.applyImport(second);
      expect(result.listSendsAdded).toBe(0);
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(1);
    });

    it('merges by signature: only unseen sends are added', async () => {
      await service.applyImport(await service.previewImport(backupV3([], [], [sampleSend])));

      const different = {
        ...sampleSend,
        fecha: new Date('2026-09-23T10:00:00.000Z'),
      };
      const preview = await service.previewImport(
        backupV3([], [], [{ ...sampleSend, id: 42 }, different])
      );
      expect(preview.listSendsToAdd).toHaveLength(1);

      const result = await service.applyImport(preview);
      expect(result.listSendsAdded).toBe(1);
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(2);
    });

    it('applyImport only adds list sends whose signature is still unseen', async () => {
      await service.applyImport(await service.previewImport(backupV3([], [], [sampleSend])));

      // A stale preview that still carries the already-stored send must not
      // duplicate it when applied again.
      const stalePreview = await service.previewImport(backupV3([], [], [{ ...sampleSend, id: 7 }]));
      expect(stalePreview.listSendsToAdd).toHaveLength(0);

      const forged = { ...stalePreview, listSendsToAdd: [{ ...sampleSend, id: 7 }] };
      const result = await service.applyImport(forged);
      expect(result.listSendsAdded).toBe(0);
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(1);
    });

    it('preview writes no list sends either', async () => {
      await service.previewImport(backupV3([], [], [sampleSend]));
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(0);
    });

    it('continues past a failing list send so later sends still persist', async () => {
      const sends = [1, 2, 3].map((n) => ({
        ...sampleSend,
        fecha: new Date(`2026-09-2${n}T10:00:00.000Z`),
        cliente: `Cliente ${n}`,
      }));
      const preview = await service.previewImport(backupV3([], [], sends));
      expect(preview.listSendsToAdd).toHaveLength(3);

      const realCreate = repos.listSends.create.bind(repos.listSends);
      let calls = 0;
      repos.listSends.create = (data) => {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error('send write failed'));
        return realCreate(data);
      };

      const result = await service.applyImport(preview);

      expect(result.listSendsAdded).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nombre).toBe('(lista enviada de Cliente 2)');
      expect(result.errors[0].error).toBe('send write failed');
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(2);
    });

    it('labels a nameless-client send failure as (lista enviada)', async () => {
      const preview = await service.previewImport(
        backupV3([], [], [{ ...sampleSend, cliente: '   ' }])
      );
      repos.listSends.create = () => Promise.reject(new Error('nope'));

      const result = await service.applyImport(preview);

      expect(result.listSendsAdded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nombre).toBe('(lista enviada)');
    });

    it('reports a mid-batch send with a non-string client as a generic label and keeps later sends', async () => {
      const sends = [
        { ...sampleSend, fecha: new Date('2026-09-21T10:00:00.000Z'), cliente: 'Uno' },
        {
          ...sampleSend,
          fecha: new Date('2026-09-22T10:00:00.000Z'),
          cliente: 123 as unknown as string,
        },
        { ...sampleSend, fecha: new Date('2026-09-23T10:00:00.000Z'), cliente: 'Tres' },
      ];
      const realCreate = repos.listSends.create.bind(repos.listSends);
      let calls = 0;
      repos.listSends.create = (data) => {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error('send write failed'));
        return realCreate(data);
      };

      const result = await service.applyImport(emptyPreview({ listSendsToAdd: sends }));

      expect(result.listSendsAdded).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nombre).toBe('(lista enviada)');
      expect(await repos.listSends.listOwn(PRINCIPAL.userId)).toHaveLength(2);
    });
  });

  describe('owner scoping', () => {
    it('matches and merges against the user own partition only, even when RLS shows foreign rows', async () => {
      const adminRepos = await adminReposWithForeignRows();
      const adminService = createBackupService(adminRepos, 'admin-1');

      const preview = await adminService.previewImport(
        backupV3([validProduct], [sampleQuote], [sampleSend])
      );

      // The foreign rows are RLS-visible through list()...
      expect(await adminRepos.products.list()).toHaveLength(1);
      expect(await adminRepos.quotes.list()).toHaveLength(1);
      expect(await adminRepos.listSends.list()).toHaveLength(1);

      // ...but they must not satisfy an own-partition match.
      expect(preview.toUpdate).toHaveLength(0);
      expect(preview.toAdd).toHaveLength(1);
      expect(preview.quotesToAdd).toHaveLength(1);
      expect(preview.listSendsToAdd).toHaveLength(1);
    });
  });
});

describe('createBackupService.exportBackup', () => {
  let capturedBlob: Blob | undefined;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    capturedBlob = undefined;
    URL.createObjectURL = ((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('exports the user own partition only (products, quotes and list sends)', async () => {
    const adminRepos = await adminReposWithForeignRows();
    await adminRepos.products.create(validProduct);
    await adminRepos.quotes.create({
      fecha: sampleQuote.fecha,
      cliente: 'Propio',
      items: [],
      totalNeto: 0,
      iva: 0,
      total: 0,
    });
    await adminRepos.listSends.create({
      fecha: sampleSend.fecha,
      cliente: 'Propio',
      items: [],
    });

    const service = createBackupService(adminRepos, 'admin-1');
    await service.exportBackup();

    const file = JSON.parse(await capturedBlob!.text()) as BackupFile;
    expect(file.version).toBe(3);
    expect(file.products.map((p) => p.nombre)).toEqual([validProduct.nombre]);
    expect(file.quotes.map((q) => q.cliente)).toEqual(['Propio']);
    expect(file.listSends.map((s) => s.cliente)).toEqual(['Propio']);
  });
});

/**
 * An admin principal whose RLS-visible set also contains one foreign product,
 * quote and list send owned by `vendor-b`, while the admin owns nothing yet.
 */
async function adminReposWithForeignRows(): Promise<Repositories> {
  const principal: Principal = { userId: 'admin-1', isAdmin: true };
  const products = createInMemoryProductsRepo(principal);
  await products.seedIfEmpty('vendor-b', [validProduct]);

  const quotes = createInMemoryQuotesRepo(principal, [
    {
      id: 1,
      fecha: sampleQuote.fecha,
      cliente: sampleQuote.cliente,
      items: sampleQuote.items,
      totalNeto: sampleQuote.totalNeto,
      iva: sampleQuote.iva,
      total: sampleQuote.total,
      ownerId: 'vendor-b',
    },
  ]);
  const listSends = createInMemoryListSendsRepo(principal, [
    {
      id: 1,
      fecha: sampleSend.fecha,
      cliente: sampleSend.cliente,
      items: sampleSend.items,
      ownerId: 'vendor-b',
    },
  ]);

  return {
    products,
    quotes,
    listSends,
    clients: createInMemoryClientsRepo(quotes, listSends),
  };
}
