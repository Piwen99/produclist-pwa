import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createProductsCache, useProductsSnapshot } from '../ProductsCache';
import type { Product } from '../../types/product';

const P1: Product = {
  id: 1,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1000,
  disponible: true,
};

const P2: Product = {
  id: 2,
  nombre: 'Nueces',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 2000,
  disponible: true,
};

describe('createProductsCache', () => {
  it('starts with an undefined snapshot', () => {
    expect(createProductsCache().getSnapshot()).toBeUndefined();
  });

  it('replaces the snapshot and notifies every subscriber on set', () => {
    const cache = createProductsCache();
    const first = vi.fn();
    const second = vi.fn();
    cache.subscribe(first);
    cache.subscribe(second);

    cache.set([P1]);

    expect(cache.getSnapshot()).toEqual([P1]);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    cache.set([P1, P2]);

    expect(cache.getSnapshot()).toEqual([P1, P2]);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('stops notifying a listener after unsubscribe', () => {
    const cache = createProductsCache();
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);

    unsubscribe();
    cache.set([P1]);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useProductsSnapshot', () => {
  it('returns undefined until set and re-renders with the new snapshot', () => {
    const cache = createProductsCache();
    const { result } = renderHook(() => useProductsSnapshot(cache));

    expect(result.current).toBeUndefined();

    act(() => {
      cache.set([P1]);
    });

    expect(result.current).toEqual([P1]);
  });
});
