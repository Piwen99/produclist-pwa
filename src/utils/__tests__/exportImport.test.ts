import { describe, it, expect, beforeEach } from 'vitest';
import { parseProductImport, previewImport, applyImport } from '../exportImport';
import { db } from '../../db/database';
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

describe('previewImport / applyImport', () => {
  beforeEach(async () => {
    await db.products.clear();
  });

  it('preview writes nothing and separates adds from updates', async () => {
    await db.products.add(validProduct);
    const text = JSON.stringify([
      { ...validProduct, precioNeto: 9900 },
      { ...validProduct, nombre: 'NUEZ NUEVA', precioNeto: 5000 },
    ]);

    const preview = await previewImport(text);
    expect(preview.toUpdate).toHaveLength(1);
    expect(preview.toAdd).toHaveLength(1);

    // The dry-run must not have touched the catalog
    const afterPreview = await db.products.toArray();
    expect(afterPreview).toHaveLength(1);
    expect(afterPreview[0].precioNeto).toBe(9200);
  });

  it('applyImport writes the adds and the updates', async () => {
    await db.products.add(validProduct);
    const preview = await previewImport(
      JSON.stringify([
        { ...validProduct, precioNeto: 9900 },
        { ...validProduct, nombre: 'NUEZ NUEVA', precioNeto: 5000 },
      ])
    );

    const result = await applyImport(preview);
    expect(result.updated).toBe(1);
    expect(result.success).toBe(1);

    const all = await db.products.toArray();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.nombre === 'ALMENDRA LAMINADA')?.precioNeto).toBe(9900);
    expect(all.find((p) => p.nombre === 'NUEZ NUEVA')?.precioNeto).toBe(5000);
  });

  it('applyImport reports parse errors alongside the applied changes', async () => {
    const preview = await previewImport(
      JSON.stringify([validProduct, { ...validProduct, nombre: '  ', precioNeto: 10 }])
    );
    const result = await applyImport(preview);
    expect(result.success).toBe(1);
    expect(result.errors).toHaveLength(1);
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

const backupV2 = (products: unknown[], quotes: unknown[]) =>
  JSON.stringify({
    version: 2,
    exportedAt: '2026-09-25T12:00:00.000Z',
    products,
    quotes,
  });

describe('backup v2 (products + quotes)', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.quotes.clear();
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
    const { valid, quotes } = parseProductImport(JSON.stringify([validProduct]));
    expect(valid).toHaveLength(1);
    expect(quotes).toHaveLength(0);
  });

  it('adds a quote that this device does not have yet', async () => {
    const preview = await previewImport(backupV2([], [sampleQuote]));
    expect(preview.quotesToAdd).toHaveLength(1);

    const result = await applyImport(preview);
    expect(result.quotesAdded).toBe(1);

    const stored = await db.quotes.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].total).toBe(21896);
  });

  it('does not duplicate a quote the device already has (merge by content)', async () => {
    await applyImport(await previewImport(backupV2([], [sampleQuote])));

    // Same quote again, even with a different id: content match must skip it.
    const second = await previewImport(backupV2([], [{ ...sampleQuote, id: 999 }]));
    expect(second.quotesToAdd).toHaveLength(0);
    expect(await db.quotes.count()).toBe(1);
  });

  it('preview writes no quotes either', async () => {
    await previewImport(backupV2([], [sampleQuote]));
    expect(await db.quotes.count()).toBe(0);
  });
});
