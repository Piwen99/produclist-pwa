import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuote } from '../useQuote';
import type { Product } from '../../types/product';

// Mock product helpers
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '11,34',
  precioNeto: 15000,
  disponible: true,
  ...overrides,
});

describe('useQuote', () => {
  describe('initial state', () => {
    it('should start with empty items array', () => {
      const { result } = renderHook(() => useQuote());
      expect(result.current.items).toEqual([]);
    });

    it('should start with zero totals', () => {
      const { result } = renderHook(() => useQuote());
      expect(result.current.totals).toEqual({
        totalKg: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
      });
    });
  });

  describe('addItem', () => {
    it('should add a product with cantidad=0 and precioKg=0', () => {
      const { result } = renderHook(() => useQuote());
      const mockProduct = createMockProduct({ id: 1, nombre: 'Chía', formato: '1,5' });

      act(() => {
        result.current.addItem(mockProduct);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]).toMatchObject({
        productId: 1,
        nombre: 'Chía',
        formato: '1,5',
        cantidad: 0,
        precioKg: 0,
      });
      expect(result.current.items[0].id).toBeDefined();
    });

    it('should add multiple items with unique ids', () => {
      const { result } = renderHook(() => useQuote());
      const product1 = createMockProduct({ id: 1, nombre: 'Almendras' });
      const product2 = createMockProduct({ id: 2, nombre: 'Chía' });

      act(() => {
        result.current.addItem(product1);
        result.current.addItem(product2);
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).not.toBe(result.current.items[1].id);
    });
  });

  describe('removeItem', () => {
    it('should remove item by id', () => {
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ id: 1, nombre: 'Almendras' });

      act(() => {
        result.current.addItem(product);
      });
      expect(result.current.items).toHaveLength(1);

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.removeItem(itemId);
      });
      expect(result.current.items).toHaveLength(0);
    });

    it('should not affect other items when removing', () => {
      const { result } = renderHook(() => useQuote());
      const product1 = createMockProduct({ id: 1, nombre: 'Almendras' });
      const product2 = createMockProduct({ id: 2, nombre: 'Chía' });

      act(() => {
        result.current.addItem(product1);
        result.current.addItem(product2);
      });

      const idToRemove = result.current.items[0].id;
      act(() => {
        result.current.removeItem(idToRemove);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].nombre).toBe('Chía');
    });
  });

  describe('updateItemQty', () => {
    it('should update cantidad for an item', () => {
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ id: 1 });

      act(() => {
        result.current.addItem(product);
      });

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.updateItemQty(itemId, 5);
      });

      expect(result.current.items[0].cantidad).toBe(5);
    });
  });

  describe('updateItemPrecioKg', () => {
    it('should update precioKg for an item', () => {
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ id: 1 });

      act(() => {
        result.current.addItem(product);
      });

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.updateItemPrecioKg(itemId, 15000);
      });

      expect(result.current.items[0].precioKg).toBe(15000);
    });
  });

  describe('clearAll', () => {
    it('should remove all items', () => {
      const { result } = renderHook(() => useQuote());
      const product1 = createMockProduct({ id: 1 });
      const product2 = createMockProduct({ id: 2 });

      act(() => {
        result.current.addItem(product1);
        result.current.addItem(product2);
      });
      expect(result.current.items).toHaveLength(2);

      act(() => {
        result.current.clearAll();
      });
      expect(result.current.items).toHaveLength(0);
    });

    it('should reset totals to zero after clear', () => {
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ id: 1 });

      act(() => {
        result.current.addItem(product);
      });

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.updateItemQty(itemId, 5);
        result.current.updateItemPrecioKg(itemId, 10000);
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.totals).toEqual({
        totalKg: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
      });
    });
  });

  describe('totals calculation', () => {
    it('should calculate single item totals correctly', () => {
      // formato "11,34" = 11.34 kg, cantidad=10 → totalKg = 113.4
      // precioKg=100 → subtotal = 11340, iva=2155 (rounded), total=13495
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ formato: '11,34' });

      act(() => {
        result.current.addItem(product);
      });

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.updateItemQty(itemId, 10);
        result.current.updateItemPrecioKg(itemId, 100);
      });

      // totalKg = 11.34 * 10 = 113.4
      expect(result.current.totals.totalKg).toBeCloseTo(113.4);
      // subtotal = 113.4 * 100 = 11340
      expect(result.current.totals.subtotal).toBe(11340);
      // iva = Math.round(11340 * 0.19) = 2155
      expect(result.current.totals.iva).toBe(2155);
      // total = 11340 + 2155 = 13495
      expect(result.current.totals.total).toBe(13495);
    });

    it('should calculate multiple items totals', () => {
      // Item 1: formato "11,34", cantidad=10, precioKg=100 → subtotal=11340
      // Item 2: formato "1", cantidad=5, precioKg=2000 → subtotal=10000
      // totalKg = 113.4 + 5 = 118.4
      // subtotal = 11340 + 10000 = 21340
      // iva = Math.round(21340 * 0.19) = 4055
      // total = 21340 + 4055 = 25395
      const { result } = renderHook(() => useQuote());
      const product1 = createMockProduct({ id: 1, formato: '11,34' });
      const product2 = createMockProduct({ id: 2, formato: '1' });

      act(() => {
        result.current.addItem(product1);
        result.current.addItem(product2);
      });

      const item1Id = result.current.items[0].id;
      const item2Id = result.current.items[1].id;

      act(() => {
        result.current.updateItemQty(item1Id, 10);
        result.current.updateItemPrecioKg(item1Id, 100);
        result.current.updateItemQty(item2Id, 5);
        result.current.updateItemPrecioKg(item2Id, 2000);
      });

      expect(result.current.totals.totalKg).toBeCloseTo(118.4);
      expect(result.current.totals.subtotal).toBe(21340);
      expect(result.current.totals.iva).toBe(4055);
      expect(result.current.totals.total).toBe(25395);
    });

    it('should return zero totals for empty cart', () => {
      const { result } = renderHook(() => useQuote());

      expect(result.current.totals.totalKg).toBe(0);
      expect(result.current.totals.subtotal).toBe(0);
      expect(result.current.totals.iva).toBe(0);
      expect(result.current.totals.total).toBe(0);
    });

    it('should handle zero precioKg', () => {
      const { result } = renderHook(() => useQuote());
      const product = createMockProduct({ formato: '10' });

      act(() => {
        result.current.addItem(product);
      });

      const itemId = result.current.items[0].id;
      act(() => {
        result.current.updateItemQty(itemId, 5);
        result.current.updateItemPrecioKg(itemId, 0);
      });

      // totalKg = 10 * 5 = 50
      expect(result.current.totals.totalKg).toBeCloseTo(50);
      // subtotal = 50 * 0 = 0
      expect(result.current.totals.subtotal).toBe(0);
      expect(result.current.totals.total).toBe(0);
    });
  });
});