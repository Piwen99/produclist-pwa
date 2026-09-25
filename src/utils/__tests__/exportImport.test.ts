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
