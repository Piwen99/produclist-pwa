import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DataProvider } from '../../data/DataProvider';
import { useProducts } from '../useProducts';
import { useAddProduct } from '../useAddProduct';
import { useUpdateProduct } from '../useUpdateProduct';
import { useDeleteProduct } from '../useDeleteProduct';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { ProductsRepo, Repositories } from '../../data/ports';
import type { Product, ProductInput } from '../../types/product';

const INPUT: ProductInput = {
  nombre: 'Nueces',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 2000,
  disponible: true,
};

const P1: Product = { id: 1, ...INPUT, ownerId: 'user-1' };

function useProductsAndMutations() {
  const products = useProducts();
  const { add } = useAddProduct();
  const { update } = useUpdateProduct();
  const { remove } = useDeleteProduct();
  return { products, add, update, remove };
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('product mutation hooks', () => {
  it('adds through the repo, resolves to the created id and refreshes the cache', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    const create = vi.fn<ProductsRepo['create']>().mockResolvedValue(P1);
    const repos: Repositories = withProducts(createRepo({ list, create }));
    const { result } = renderHook(() => useProductsAndMutations(), {
      wrapper: wrapperFor(repos),
    });

    await waitFor(() => expect(result.current.products).toEqual([P1]));

    let returnedId: number | undefined;
    await act(async () => {
      returnedId = await result.current.add(INPUT);
    });

    expect(create).toHaveBeenCalledWith(INPUT);
    expect(returnedId).toBe(P1.id);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('updates through the repo and refreshes the cache', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    const update = vi.fn<ProductsRepo['update']>().mockResolvedValue(undefined);
    const repos: Repositories = withProducts(createRepo({ list, update }));
    const { result } = renderHook(() => useProductsAndMutations(), {
      wrapper: wrapperFor(repos),
    });

    await waitFor(() => expect(result.current.products).toEqual([P1]));

    await act(async () => {
      await result.current.update(1, { precioNeto: 5 });
    });

    expect(update).toHaveBeenCalledWith(1, { precioNeto: 5 });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('deletes through the repo and refreshes the cache', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    const remove = vi.fn<ProductsRepo['remove']>().mockResolvedValue(undefined);
    const repos: Repositories = withProducts(createRepo({ list, remove }));
    const { result } = renderHook(() => useProductsAndMutations(), {
      wrapper: wrapperFor(repos),
    });

    await waitFor(() => expect(result.current.products).toEqual([P1]));

    await act(async () => {
      await result.current.remove(1);
    });

    expect(remove).toHaveBeenCalledWith(1);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('propagates a create failure from the repo', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const create = vi
      .fn<ProductsRepo['create']>()
      .mockRejectedValue(new Error('Ya existe un producto llamado "Nueces"'));
    const repos: Repositories = withProducts(createRepo({ create }));
    const { result } = renderHook(() => useProductsAndMutations(), {
      wrapper: wrapperFor(repos),
    });

    await waitFor(() => expect(result.current.products).toEqual([]));

    await act(async () => {
      await expect(result.current.add(INPUT)).rejects.toThrow(
        'Ya existe un producto llamado "Nueces"',
      );
    });

    expect(errorSpy).toHaveBeenCalled();
  });

  it('runs the full add/update/delete flow through in-memory ports', async () => {
    const repos = createInMemoryRepositories({ userId: 'user-1', isAdmin: false });
    const { result } = renderHook(() => useProductsAndMutations(), {
      wrapper: wrapperFor(repos),
    });

    await waitFor(() => expect(result.current.products).toEqual([]));

    let id = 0;
    await act(async () => {
      id = await result.current.add(INPUT);
    });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.products?.[0].nombre).toBe('Nueces');

    await act(async () => {
      await result.current.update(id, { nombre: 'Nueces Mariposa' });
    });
    await waitFor(() => expect(result.current.products?.[0].nombre).toBe('Nueces Mariposa'));

    await act(async () => {
      await result.current.remove(id);
    });
    await waitFor(() => expect(result.current.products).toEqual([]));
  });
});
