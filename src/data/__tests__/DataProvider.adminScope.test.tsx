import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataProvider } from '../DataProvider';
import { useData } from '../useData';
import { createInMemoryRepositories } from '../testing/inMemoryRepos';
import { QuoteProductSelector } from '../../components/QuoteProductSelector';
import type { ProductsRepo, Repositories } from '../ports';
import type { Product, ProductInput } from '../../types/product';

/**
 * Regression coverage for the owner-scoped catalog read. The products cache used
 * to be filled from the RLS-visible `list()`, which for an admin also returns
 * every other owner's rows: the other vendors' catalogs merged into the admin's
 * list and could not be deleted. See odd/tasks/catalog-scope-and-pdf.md (S1, S2,
 * S4) — these are the boundaries the seam probes pinned, kept as tests.
 */

const OWN: Product = {
  id: 1,
  nombre: 'Propio',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 100,
  disponible: true,
  ownerId: 'admin-1',
};

const FOREIGN: Product = { ...OWN, id: 2, nombre: 'Ajeno', ownerId: 'vendor-a' };

function repo(options: { visible?: Product[]; own?: Product[] } = {}): ProductsRepo {
  return {
    list: () => Promise.resolve(options.visible ?? []),
    listOwn: () => Promise.resolve(options.own ?? []),
    create: () => Promise.reject(new Error('not used')),
    update: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    seedIfEmpty: () => Promise.resolve(),
  };
}

/** The given products repo inside an otherwise inert port set. */
function withProducts(products: ProductsRepo): Repositories {
  return { ...createInMemoryRepositories({ userId: 'admin-1', isAdmin: true }, []), products };
}

function Snapshot() {
  const { products } = useData();
  return (
    <span data-testid="snapshot">
      {products === undefined ? 'undefined' : products.map((product) => product.nombre).join('|')}
    </span>
  );
}

describe('DataProvider owner-scoped catalog', () => {
  it('keeps an empty owner catalog as an empty list, not as a loading skeleton', async () => {
    render(
      <DataProvider
        repos={withProducts(repo({ visible: [OWN, FOREIGN], own: [] }))}
        userId="admin-1"
      >
        <Snapshot />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('snapshot')).toHaveTextContent(''));
  });

  it('keeps the loading skeleton when the owner-scoped read fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing: ProductsRepo = {
      ...repo(),
      listOwn: () => Promise.reject(new Error('offline')),
    };

    render(
      <DataProvider repos={withProducts(failing)} userId="admin-1">
        <Snapshot />
      </DataProvider>,
    );

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[DataProvider] Failed to refresh products',
        expect.any(Error),
      ),
    );
    expect(screen.getByTestId('snapshot')).toHaveTextContent('undefined');
    errorSpy.mockRestore();
  });

  it('leaves the vendor path unchanged: the owner-scoped read equals the RLS-visible one', async () => {
    const seed: ProductInput[] = [
      { nombre: 'A', categoria: 'Frutos Secos', formato: '1', precioNeto: 1, disponible: true },
      { nombre: 'B', categoria: 'Frutos Secos', formato: '1', precioNeto: 1, disponible: false },
      { nombre: 'C', categoria: 'Frutos Secos', formato: '1', precioNeto: 1, disponible: true },
    ];
    const repos = createInMemoryRepositories({ userId: 'vendor-1', isAdmin: false }, seed);

    expect(await repos.products.list()).toEqual(await repos.products.listOwn('vendor-1'));

    render(
      <DataProvider repos={repos} userId="vendor-1">
        <Snapshot />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('snapshot')).toHaveTextContent('A|B|C'));
  });

  it('feeds the cotizador selector only the owner-scoped catalog', async () => {
    render(
      <DataProvider
        repos={withProducts(repo({ visible: [OWN, FOREIGN], own: [OWN] }))}
        userId="admin-1"
      >
        <QuoteProductSelector onSelect={() => undefined} onClose={() => undefined} />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByText('Propio')).toBeInTheDocument());
    expect(screen.queryByText('Ajeno')).not.toBeInTheDocument();
  });
});
