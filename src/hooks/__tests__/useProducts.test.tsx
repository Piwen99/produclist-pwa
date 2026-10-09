import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DataProvider } from '../../data/DataProvider';
import { useProducts } from '../useProducts';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { ProductsRepo, Repositories } from '../../data/ports';
import type { Product } from '../../types/product';

const P1: Product = {
  id: 1,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1000,
  disponible: true,
  ownerId: 'user-1',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createRepo(overrides: Partial<ProductsRepo> = {}): ProductsRepo {
  return {
    list: vi.fn().mockResolvedValue([]),
    listOwn: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(P1),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    seedIfEmpty: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** A full port set whose products repo is the given mock; the rest are inert. */
function withProducts(products: ProductsRepo): Repositories {
  return {
    ...createInMemoryRepositories({ userId: 'user-1', isAdmin: false }),
    products,
  };
}

function wrapperFor(repos: Repositories) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DataProvider repos={repos} userId="user-1">
        {children}
      </DataProvider>
    );
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useProducts', () => {
  it('stays undefined until the first successful load', async () => {
    const pending = deferred<Product[]>();
    const repos: Repositories = withProducts(
      createRepo({ list: vi.fn(() => pending.promise) }),
    );

    const { result } = renderHook(() => useProducts(), { wrapper: wrapperFor(repos) });

    expect(result.current).toBeUndefined();

    await act(async () => {
      pending.resolve([P1]);
      await pending.promise;
    });

    await waitFor(() => expect(result.current).toEqual([P1]));
  });

  it('stays undefined when the first load fails so the skeleton shows', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repos: Repositories = withProducts(
      createRepo({ list: vi.fn().mockRejectedValue(new Error('offline')) }),
    );

    const { result } = renderHook(() => useProducts(), { wrapper: wrapperFor(repos) });

    await waitFor(() => expect(repos.products.list).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('exposes the products loaded by the provider', async () => {
    const repos: Repositories = withProducts(
      createRepo({ list: vi.fn().mockResolvedValue([P1]) }),
    );

    const { result } = renderHook(() => useProducts(), { wrapper: wrapperFor(repos) });

    await waitFor(() => expect(result.current).toEqual([P1]));
  });

  it('throws when used outside a DataProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useProducts())).toThrow(
      'useData must be used within a DataProvider',
    );
    spy.mockRestore();
  });
});
