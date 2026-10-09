import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteProductSelector } from '../QuoteProductSelector';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { ProductsRepo } from '../../data/ports';
import type { Product } from '../../types/product';

const allProducts: Product[] = [
  { id: 1, nombre: 'Almendras', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 15000, disponible: true },
  { id: 2, nombre: 'Chía', categoria: 'Semillas/Cereal', formato: '1,5', precioNeto: 9200, disponible: true },
  { id: 3, nombre: 'Maní', categoria: 'Frutos Secos', formato: '2', precioNeto: 4000, disponible: false },
  { id: 4, nombre: 'Pasas', categoria: 'Fruta Deshidratada', formato: '0,5', precioNeto: 2500, disponible: true },
];

const mockOnSelect = vi.fn();
const mockOnClose = vi.fn();

// The selector must read products from `useData()`. `undefined` simulates the
// pre-first-load state (the provider has no snapshot yet).
function setup(products: Product[] | undefined = allProducts) {
  const base = createInMemoryRepositories(
    { userId: 'user-1', isAdmin: false },
    products ?? [],
  );
  // The provider seeds the base catalog on mount; these tests drive the
  // catalog explicitly, so seeding is neutralized to keep the fixture exact.
  const productsRepo: ProductsRepo = {
    ...base.products,
    seedIfEmpty: vi.fn<ProductsRepo['seedIfEmpty']>().mockResolvedValue(undefined),
    ...(products === undefined
      ? {
          list: vi
            .fn<ProductsRepo['list']>()
            .mockReturnValue(new Promise<Product[]>(() => {})),
        }
      : {}),
  };
  const repos = { ...base, products: productsRepo };

  return render(
    <DataProvider repos={repos} userId="user-1">
      <QuoteProductSelector onSelect={mockOnSelect} onClose={mockOnClose} />
    </DataProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuoteProductSelector', () => {
  it('should render the modal when open', async () => {
    setup();
    expect(await screen.findByText('Seleccionar Producto')).toBeInTheDocument();
  });

  it('should display available products', async () => {
    setup();
    expect(await screen.findByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
    expect(screen.getByText('Pasas')).toBeInTheDocument();
  });

  it('should display unavailable products too (all products are quotable)', async () => {
    setup();
    // Maní is marked unavailable, but the user deliberately wants to be able
    // to quote every product regardless of `disponible`.
    expect(await screen.findByText('Maní')).toBeInTheDocument();
  });

  it('should display product formato next to name', async () => {
    setup();
    const almondsButton = await screen.findByRole('button', { name: /almendras/i });
    expect(almondsButton).toHaveTextContent('11,34 kg');
  });

  it('should call onSelect when a product is clicked', async () => {
    setup();
    fireEvent.click(await screen.findByText('Almendras'));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Almendras', id: 1 }),
    );
  });

  it('should filter products by search term', async () => {
    setup();
    const searchInput = await screen.findByPlaceholderText('Buscar productos…');
    // Search for "al" - should match "Almendras"
    fireEvent.change(searchInput, { target: { value: 'al' } });
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.queryByText('Chía')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasas')).not.toBeInTheDocument();
  });

  it('should show no results message when search has no matches', async () => {
    setup();
    const searchInput = await screen.findByPlaceholderText('Buscar productos…');
    fireEvent.change(searchInput, { target: { value: 'xyz' } });
    expect(screen.getByText(/No hay productos que coincidan/)).toBeInTheDocument();
  });

  it('should show empty state when no available products', async () => {
    setup([]);
    expect(await screen.findByText('No hay productos disponibles')).toBeInTheDocument();
  });

  it('should show the loading placeholder before the first load resolves', () => {
    setup(undefined);
    expect(screen.getByText('Cargando productos...')).toBeInTheDocument();
  });

  it('should call onSelect with correct product data including formato', async () => {
    setup();
    fireEvent.click(await screen.findByText('Chía'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Chía',
        formato: '1,5',
        disponible: true,
      }),
    );
  });

  it('should clear search and show all when X is clicked', async () => {
    setup();
    const searchInput = await screen.findByPlaceholderText('Buscar productos…');
    fireEvent.change(searchInput, { target: { value: 'al' } });
    expect(screen.getByText('Almendras')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });

  it('should expose dialog semantics with the title as accessible name', async () => {
    setup();
    await screen.findByText('Almendras');

    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Producto' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'quote-selector-title');
  });

  it('should render a single "Seleccionar Producto" heading inside the dialog', async () => {
    setup();
    await screen.findByText('Almendras');

    const headings = screen.getAllByRole('heading', { name: 'Seleccionar Producto' });
    expect(headings).toHaveLength(1);

    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Producto' });
    expect(dialog).toContainElement(headings[0]);
  });

  it('should render the close button inside the dialog and call onClose when clicked', async () => {
    setup();
    await screen.findByText('Almendras');

    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Producto' });
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });

    expect(dialog).toContainElement(closeButton);

    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
