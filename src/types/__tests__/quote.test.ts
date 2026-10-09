import { describe, it, expect } from 'vitest';
import { DRAFT_KEY } from '../quote';
import type { QuoteDraft, QuoteItem, QuoteTotals, SavedQuote } from '../quote';

describe('QuoteItem interface', () => {
  it('should accept valid QuoteItem objects', () => {
    const item: QuoteItem = {
      id: 'test-id-123',
      productId: 1,
      nombre: 'Almendras',
      formato: '11,34',
      cantidad: 5,
      precioKg: 15000,
    };

    expect(item.id).toBe('test-id-123');
    expect(item.productId).toBe(1);
    expect(item.nombre).toBe('Almendras');
    expect(item.formato).toBe('11,34');
    expect(item.cantidad).toBe(5);
    expect(item.precioKg).toBe(15000);
  });

  it('should accept minimal quantity of 1', () => {
    const item: QuoteItem = {
      id: 'min-qty',
      productId: 2,
      nombre: 'Chía',
      formato: '0,5',
      cantidad: 1,
      precioKg: 9200,
    };
    expect(item.cantidad).toBe(1);
  });
});

describe('QuoteTotals interface', () => {
  it('should accept valid QuoteTotals objects', () => {
    const totals: QuoteTotals = {
      totalKg: 113.4,
      subtotal: 1701000,
      iva: 323190,
      total: 2024190,
    };

    expect(totals.totalKg).toBe(113.4);
    expect(totals.subtotal).toBe(1701000);
    expect(totals.iva).toBe(323190);
    expect(totals.total).toBe(2024190);
  });

  it('should accept zero totals', () => {
    const totals: QuoteTotals = {
      totalKg: 0,
      subtotal: 0,
      iva: 0,
      total: 0,
    };

    expect(totals.totalKg).toBe(0);
    expect(totals.subtotal).toBe(0);
    expect(totals.iva).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe('SavedQuote interface', () => {
  it('should accept a quote with an optional ownerId', () => {
    const quote: SavedQuote = {
      id: 1,
      fecha: new Date('2026-10-08'),
      cliente: 'Juan',
      items: [],
      totalNeto: 2000,
      iva: 380,
      total: 2380,
      ownerId: 'user-1',
    };

    expect(quote.ownerId).toBe('user-1');
    expect(quote.cliente).toBe('Juan');
  });

  it('should allow omitting ownerId and cliente', () => {
    const quote: SavedQuote = {
      fecha: new Date('2026-10-08'),
      items: [],
      totalNeto: 0,
      iva: 0,
      total: 0,
    };

    expect(quote.ownerId).toBeUndefined();
    expect(quote.cliente).toBeUndefined();
  });
});

describe('QuoteDraft interface', () => {
  it('should use the fixed draft id', () => {
    const draft: QuoteDraft = {
      id: 'draft',
      items: [],
      totalNeto: 0,
      iva: 0,
      total: 0,
    };

    expect(draft.id).toBe(DRAFT_KEY);
    expect(DRAFT_KEY).toBe('draft');
  });
});