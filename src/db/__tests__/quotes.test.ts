import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database';
import { saveQuote, getAllQuotes, deleteQuote, saveQuoteDraft, loadQuoteDraft, clearQuoteDraft } from '../database';
import type { QuoteItem } from '../../types/quote';

describe('quotes database', () => {
  beforeEach(async () => {
    // Clear quotes before each test
    await db.quotes.clear();
  });

  describe('saveQuote', () => {
    it('should save a quote with items and totals', async () => {
      const items: QuoteItem[] = [
        { id: 'item-1', productId: 1, nombre: 'ALMENDRA LAMINADA', formato: '11,34', cantidad: 2, precioKg: 9200 },
      ];
      const id = await saveQuote({ items, totalNeto: 208416, iva: 39599, total: 247615 });

      expect(id).toBeGreaterThan(0);

      const saved = await db.quotes.get(id);
      expect(saved).toBeDefined();
      expect(saved?.items).toHaveLength(1);
      expect(saved?.items[0].nombre).toBe('ALMENDRA LAMINADA');
      expect(saved?.totalNeto).toBe(208416);
      expect(saved?.iva).toBe(39599);
      expect(saved?.total).toBe(247615);
      expect(saved?.fecha).toBeInstanceOf(Date);
    });

    it('should use provided fecha when passed', async () => {
      const customDate = new Date('2024-01-15T10:30:00');
      const items: QuoteItem[] = [
        { id: 'item-1', productId: 1, nombre: 'Chía', formato: '25', cantidad: 1, precioKg: 2800 },
      ];
      const id = await saveQuote({ items, totalNeto: 70000, iva: 13300, total: 83300, fecha: customDate });

      const saved = await db.quotes.get(id);
      expect(saved?.fecha.toISOString()).toBe(customDate.toISOString());
    });

    it('should use current date when fecha not provided', async () => {
      const before = new Date();
      const items: QuoteItem[] = [];
      const id = await saveQuote({ items: [], totalNeto: 0, iva: 0, total: 0 });
      const after = new Date();

      const saved = await db.quotes.get(id);
      expect(saved?.fecha.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(saved?.fecha.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getAllQuotes', () => {
    it('should return empty array when no quotes exist', async () => {
      const quotes = await getAllQuotes();
      expect(quotes).toEqual([]);
    });

    it('should return all quotes ordered by fecha descending (newest first)', async () => {
      const date1 = new Date('2024-01-01T10:00:00');
      const date2 = new Date('2024-01-15T10:00:00');
      const date3 = new Date('2024-01-10T10:00:00');

      await saveQuote({ items: [], totalNeto: 100, iva: 19, total: 119, fecha: date1 });
      await saveQuote({ items: [], totalNeto: 200, iva: 38, total: 238, fecha: date2 });
      await saveQuote({ items: [], totalNeto: 150, iva: 29, total: 179, fecha: date3 });

      const quotes = await getAllQuotes();
      expect(quotes).toHaveLength(3);
      // Newest first
      expect(quotes[0].total).toBe(238);
      expect(quotes[1].total).toBe(179);
      expect(quotes[2].total).toBe(119);
    });
  });

  describe('deleteQuote', () => {
    it('should delete a quote by id', async () => {
      const id = await saveQuote({ items: [], totalNeto: 100, iva: 19, total: 119 });
      await deleteQuote(id);

      const deleted = await db.quotes.get(id);
      expect(deleted).toBeUndefined();
    });

    it('should not affect other quotes when deleting one', async () => {
      const id1 = await saveQuote({ items: [], totalNeto: 100, iva: 19, total: 119 });
      const id2 = await saveQuote({ items: [], totalNeto: 200, iva: 38, total: 238 });

      await deleteQuote(id1);

      const remaining = await getAllQuotes();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(id2);
    });
  });

  describe('quote draft (autosave)', () => {
    beforeEach(async () => {
      await db.drafts.clear();
    });

    it('saves and loads a draft with items and totals', async () => {
      const items: QuoteItem[] = [
        { id: 'item-1', productId: 1, nombre: 'ALMENDRA LAMINADA', formato: '11,34', cantidad: 2, precioKg: 9200 },
      ];

      await saveQuoteDraft({ items, totalNeto: 208416, iva: 39599, total: 247615 });
      const draft = await loadQuoteDraft();

      expect(draft).toBeDefined();
      expect(draft?.items).toHaveLength(1);
      expect(draft?.items[0].nombre).toBe('ALMENDRA LAMINADA');
      expect(draft?.total).toBe(247615);
    });

    it('overwrites the previous draft (single draft slot, last-write-wins)', async () => {
      await saveQuoteDraft({ items: [], totalNeto: 1, iva: 1, total: 1 });
      await saveQuoteDraft({ items: [], totalNeto: 999, iva: 999, total: 999 });

      const draft = await loadQuoteDraft();
      expect(draft?.totalNeto).toBe(999);
    });

    it('returns undefined when no draft exists', async () => {
      const draft = await loadQuoteDraft();
      expect(draft).toBeUndefined();
    });

    it('clears the draft', async () => {
      await saveQuoteDraft({ items: [], totalNeto: 1, iva: 1, total: 1 });
      await clearQuoteDraft();

      const draft = await loadQuoteDraft();
      expect(draft).toBeUndefined();
    });
  });
});