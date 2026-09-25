import { describe, it, expect } from 'vitest';
import { buildClientPriceHistory } from '../clientTracking';
import type { ListSend } from '../../types/listSend';
import type { SavedQuote } from '../../db/database';

const send = (fecha: string, nombre: string, precioNeto: number): ListSend => ({
  fecha: new Date(fecha),
  cliente: 'Juan',
  items: [
    { nombre, formato: '10', precioNeto, precioBruto: Math.round(precioNeto * 1.19) },
  ],
});

const quote = (fecha: string, nombre: string, precioKg: number): SavedQuote => ({
  fecha: new Date(fecha),
  cliente: 'Juan',
  items: [{ id: 'i1', productId: 1, nombre, formato: '10', cantidad: 1, precioKg }],
  totalNeto: 0,
  iva: 0,
  total: 0,
});

describe('buildClientPriceHistory', () => {
  it('keeps the most recent price per product across both sources', () => {
    const entries = buildClientPriceHistory(
      [send('2026-09-01', 'ALMENDRA', 8000)],
      [quote('2026-09-20', 'ALMENDRA', 9500)]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].precioNeto).toBe(9500);
    expect(entries[0].fuente).toBe('cotizacion');
  });

  it('prefers the list send when it is the more recent one', () => {
    const entries = buildClientPriceHistory(
      [send('2026-09-25', 'ALMENDRA', 8000)],
      [quote('2026-09-20', 'ALMENDRA', 9500)]
    );

    expect(entries[0].precioNeto).toBe(8000);
    expect(entries[0].fuente).toBe('lista');
  });

  it('matches product names case-insensitively', () => {
    const entries = buildClientPriceHistory(
      [send('2026-09-01', 'Almendra', 8000)],
      [quote('2026-09-20', 'ALMENDRA', 9500)]
    );

    expect(entries).toHaveLength(1);
  });

  it('sorts by product name', () => {
    const entries = buildClientPriceHistory(
      [send('2026-09-01', 'NUEZ', 100), send('2026-09-01', 'ALMENDRA', 100)],
      []
    );

    expect(entries.map((entry) => entry.nombre)).toEqual(['ALMENDRA', 'NUEZ']);
  });

  it('returns nothing for empty input', () => {
    expect(buildClientPriceHistory([], [])).toEqual([]);
  });
});
