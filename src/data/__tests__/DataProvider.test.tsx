import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { DataProvider } from '../DataProvider';
import { useData } from '../useData';
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
    const repos: Repositories = { products: createRepo({ list: vi.fn(() => pending.promise) }) };

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
    renderProbe({ products: createRepo({ list }) });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('refreshes when the document becomes visible', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    renderProbe({ products: createRepo({ list }) });
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
    renderProbe({ products: createRepo({ list }) });
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
    renderProbe({ products: createRepo({ list }) });
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
    renderProbe({ products: createRepo({ list, create }) });
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
    renderProbe({ products: createRepo({ list, update }) });
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
    renderProbe({ products: createRepo({ list, remove }) });
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
    const repos: Repositories = { products: createRepo() };

    const { unmount } = renderProbe(repos);
    unmount();

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(winAdd).toHaveBeenCalledWith('online', expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('refreshes on mount under StrictMode without leaking subscriptions', async () => {
    const list = vi.fn<ProductsRepo['list']>().mockResolvedValue([P1]);
    render(
      <StrictMode>
        <DataProvider repos={{ products: createRepo({ list }) }} userId="user-1">
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
        <DataProvider repos={{ products: createRepo() }} userId="vendor-7">
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
