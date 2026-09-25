import { describe, it, expect } from 'vitest';
import { buildListSendItems } from '../listSend';
import type { Product } from '../../types/product';

const product = (over: Partial<Product>): Product => ({
  nombre: 'ALMENDRA',
  categoria: 'Frutos Secos',
  formato: '11,34',
  precioNeto: 9200,
  disponible: true,
  ...over,
});

describe('buildListSendItems', () => {
  it('keeps only available products', () => {
    const items = buildListSendItems([
      product({ nombre: 'A' }),
      product({ nombre: 'B', disponible: false }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe('A');
  });

  it('snapshots net and gross prices', () => {
    const items = buildListSendItems([product({ precioNeto: 9200 })]);
    expect(items[0].precioNeto).toBe(9200);
    expect(items[0].precioBruto).toBe(10948);
  });

  it('returns an empty array when nothing is available', () => {
    expect(buildListSendItems([product({ disponible: false })])).toEqual([]);
  });
});
