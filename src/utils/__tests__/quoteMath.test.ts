import { describe, it, expect } from 'vitest';
import {
  computeQuoteTotals,
  invalidLines,
  lineKg,
  lineSubtotal,
} from '../quoteMath';
import type { QuoteItem } from '../../types/quote';

function line(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: 'line-1',
    productId: 1,
    nombre: 'Almendras',
    formato: '11,34',
    cantidad: 1,
    precioKg: 1000,
    ...overrides,
  };
}

describe('lineKg', () => {
  it('multiplies the Chilean format by the quantity', () => {
    expect(lineKg(line({ formato: '11,34', cantidad: 3 }))).toBeCloseTo(34.02);
  });

  it('returns null when the format is empty, never a silent zero', () => {
    expect(lineKg(line({ formato: '' }))).toBeNull();
  });

  it('returns null when the format is not a Chilean number', () => {
    expect(lineKg(line({ formato: 'abc' }))).toBeNull();
  });

  it('treats a non-string format as unpriceable instead of throwing', () => {
    // A tampered backup can carry a number here; `.trim()` would throw.
    expect(lineKg(line({ formato: 11.34 as unknown as string }))).toBeNull();
  });
});

describe('lineSubtotal', () => {
  it('rounds each line to whole pesos', () => {
    expect(lineSubtotal(line({ formato: '11,33', precioKg: 1001 }))).toBe(11341);
  });

  it('returns null when the line cannot be priced', () => {
    expect(lineSubtotal(line({ formato: '' }))).toBeNull();
  });
});

describe('computeQuoteTotals', () => {
  it('makes the printed lines add up to the printed subtotal (issue #95 case)', () => {
    const items = [
      line({ id: 'a', formato: '11,33', cantidad: 1, precioKg: 1001 }),
      line({ id: 'b', formato: '11,33', cantidad: 1, precioKg: 1001 }),
    ];

    const totals = computeQuoteTotals(items);

    // Two lines of 11,33 kg × $1001 print $11.341 each → $22.682, not $22.683.
    expect(lineSubtotal(items[0])).toBe(11341);
    expect(lineSubtotal(items[1])).toBe(11341);
    expect(totals.subtotal).toBe(22682);
    expect(lineSubtotal(items[0])! + lineSubtotal(items[1])!).toBe(totals.subtotal);
    // IVA and total derive from the same rounded base.
    expect(totals.iva).toBe(4310);
    expect(totals.total).toBe(26992);
  });

  it('keeps whole-peso lines unchanged', () => {
    const totals = computeQuoteTotals([
      line({ formato: '11,34', cantidad: 10, precioKg: 100 }),
      line({ id: 'b', formato: '1', cantidad: 5, precioKg: 2000 }),
    ]);

    expect(totals.subtotal).toBe(21340);
    expect(totals.iva).toBe(4055);
    expect(totals.total).toBe(25395);
    expect(totals.totalKg).toBeCloseTo(118.4);
  });

  it('returns zeroed totals for an empty cart', () => {
    expect(computeQuoteTotals([])).toEqual({
      totalKg: 0,
      subtotal: 0,
      iva: 0,
      total: 0,
    });
  });

  it('excludes an unpriceable line from every total instead of adding a zero', () => {
    const totals = computeQuoteTotals([
      line({ formato: '', cantidad: 5, precioKg: 99999 }),
      line({ id: 'b', formato: '10', cantidad: 2, precioKg: 1000 }),
    ]);

    expect(totals.subtotal).toBe(20000);
    expect(totals.totalKg).toBe(20);
  });
});

describe('invalidLines', () => {
  it('lists only the lines that cannot be priced', () => {
    const bad = line({ id: 'bad', nombre: 'Sin formato', formato: '' });
    const good = line({ id: 'good' });

    expect(invalidLines([bad, good])).toEqual([bad]);
  });

  it('returns an empty array when every line is priceable', () => {
    expect(invalidLines([line()])).toEqual([]);
  });
});
