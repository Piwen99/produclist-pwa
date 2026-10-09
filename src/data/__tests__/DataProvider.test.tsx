import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { DataProvider, SEED_TIMEOUT_MS } from '../DataProvider';
import { useData } from '../useData';
import { createInMemoryRepositories } from '../testing/inMemoryRepos';
import { seedProducts } from '../seedProducts';
import type { ProductsRepo, Repositories } from '../ports';
import type { Product, ProductInput } from '../../types/product';

const P1: Product = {
  id: 1,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1000,
  disponible: true,
  ownerId: 'user-1',
};

const INPUT: ProductInput = {
  nombre: 'Nueces',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 2000,
  disponible: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

function Probe() {
  const data = useData();
  return (
    <div>
      <span data-testid="count">
        {data.products ? String(data.products.length) : 'undefined'}
      </span>
      <span data-testid="user">{data.userId}</span>
      <button
        onClick={() => {
          void data.addProduct(INPUT);
        }}
      >
        add
      </button>
      <button
        onClick={() => {
          void data.updateProduct(1, { precioNeto: 5 });
        }}
      >
        update
      </button>
      <button
        onClick={() => {
          void data.deleteProduct(1);
        }}
      >
        delete
      </button>
    </div>
  );
}

function renderProbe(repos: Repositories, userId = 'user-1') {
  return render(
    <DataProvider repos={repos} userId={userId}>
      <Probe />
    </DataProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
});

describe('DataProvider', () => {
  it('leaves products undefined until the first successful load', async () => {
    const pending = deferred<Product[]>();
    const repos: Repositories = withProducts(
      createRepo({ list: vi.fn(() => pending.promise) }),
    );

    renderProbe(repos);
    expect(screen.getByTestId('count')).toHaveTextContent('undefined');

    await act(async () => {
      pending.resolve([P1]);
      await pending.promise;
    });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });

  it('retains the previous snapshot when a later refresh fails', async () => {
    const list = vi
      .fn<ProductsRepo['list']>()
      .mockResolvedValueOnce([P1])
      .mockRejectedValueOnce(new Error('offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderProbe(withProducts(createRepo({ list })));

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('keeps the newest snapshot when refreshes resolve out of order', async () => {
    const older = deferred<Product[]>();
    const newer = deferred<Product[]>();
    const list = vi
      .fn<ProductsRepo['list']>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    renderProbe(withProducts(createRepo({ list })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    // The newer request resolves first...
    await act(async () => {
      newer.resolve([P1, { ...P1, id: 2, nombre: 'Nueces' }]);
      await newer.promise;
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));

    // ...then the stale one lands late and must not overwrite it.
    await act(async () => {
      older.resolve([P1]);
      await older.promise;
    });
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('refreshes when the document becomes visible', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe(withProducts(createRepo({ list })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    list.mockClear();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  });

  it('does not refresh while the document stays hidden', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe(withProducts(createRepo({ list })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    list.mockClear();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('refreshes when the window comes back online', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe(withProducts(createRepo({ list })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    list.mockClear();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  });

  it('refreshes after adding a product', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([]);
    const create = vi.fn<ProductsRepo['create']>().mockResolvedValue(P1);
    renderProbe(withProducts(createRepo({ list, create })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => {
      screen.getByRole('button', { name: 'add' }).click();
    });

    await waitFor(() => expect(create).toHaveBeenCalledWith(INPUT));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('refreshes after updating a product', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([]);
    const update = vi.fn<ProductsRepo['update']>().mockResolvedValue(undefined);
    renderProbe(withProducts(createRepo({ list, update })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => {
      screen.getByRole('button', { name: 'update' }).click();
    });

    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { precioNeto: 5 }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('refreshes after deleting a product', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([]);
    const remove = vi.fn<ProductsRepo['remove']>().mockResolvedValue(undefined);
    renderProbe(withProducts(createRepo({ list, remove })));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => {
      screen.getByRole('button', { name: 'delete' }).click();
    });

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('removes the visibility and online listeners on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');
    const repos: Repositories = withProducts(createRepo());

    const { unmount } = renderProbe(repos);
    unmount();

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(winAdd).toHaveBeenCalledWith('online', expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('seeds the product catalog for the user before the first refresh', async () => {
    const seedIfEmpty = vi.fn<ProductsRepo['seedIfEmpty']>().mockResolvedValue(undefined);
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe(withProducts(createRepo({ seedIfEmpty, list })));

    await waitFor(() => expect(seedIfEmpty).toHaveBeenCalledTimes(1));
    expect(seedIfEmpty).toHaveBeenCalledWith('user-1', seedProducts);
    expect(list).toHaveBeenCalled();
  });

  it('still refreshes when seeding fails, logging the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seedIfEmpty = vi
      .fn<ProductsRepo['seedIfEmpty']>()
      .mockRejectedValue(new Error('seed down'));
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe(withProducts(createRepo({ seedIfEmpty, list })));

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(errorSpy).toHaveBeenCalledWith(
      '[DataProvider] Failed to seed products',
      expect.any(Error),
    );
  });

  it('still refreshes when seeding never settles (bounded wait)', async () => {
    vi.useFakeTimers();
    try {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const seedIfEmpty = vi
        .fn<ProductsRepo['seedIfEmpty']>()
        .mockReturnValue(new Promise(() => {}));
      const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
      renderProbe(withProducts(createRepo({ seedIfEmpty, list })));

      await act(async () => {
        await Promise.resolve();
      });
      expect(seedIfEmpty).toHaveBeenCalledTimes(1);
      expect(list).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SEED_TIMEOUT_MS);
      });

      expect(list).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[DataProvider] Failed to seed products',
        expect.any(Error),
      );
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes on mount under StrictMode without leaking subscriptions', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    render(
      <StrictMode>
        <DataProvider repos={withProducts(createRepo({ list }))} userId="user-1">
          <Probe />
        </DataProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(list).toHaveBeenCalled();
  });

  it('exposes the injected principal id', () => {
    const { result } = renderHook(() => useData(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <DataProvider repos={withProducts(createRepo())} userId="vendor-7">
          {children}
        </DataProvider>
      ),
    });

    expect(result.current.userId).toBe('vendor-7');
  });

  it('throws when useData is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useData())).toThrow(
      'useData must be used within a DataProvider',
    );
    spy.mockRestore();
  });
});
