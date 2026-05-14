import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductList } from '../ProductList';
import type { Product } from '../../types/product';

const mockProducts: Product[] = [
  { id: 1, nombre: 'Chía', categoria: 'Semillas/Cereal', formato: '11,34', precioNeto: 9200, disponible: true },
  { id: 2, nombre: 'Almendras', categoria: 'Frutos Secos', formato: '1', precioNeto: 15000, disponible: false },
  { id: 3, nombre: 'Arroz', categoria: 'Legumbres', formato: '5', precioNeto: 3000, disponible: true },
  { id: 4, nombre: 'Maní', categoria: 'Frutos Secos', formato: '2', precioNeto: 4000, disponible: false },
  { id: 5, nombre: 'Pasas', categoria: 'Fruta Deshidratada', formato: '0,5', precioNeto: 2500, disponible: true },
];

const handlers = {
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onStartEdit: vi.fn(),
};

function renderList(products?: Product[] | undefined) {
  return render(
    <ProductList
      products={products}
      onUpdate={handlers.onUpdate}
      onDelete={handlers.onDelete}
      onStartEdit={handlers.onStartEdit}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProductList — loading state', () => {
  it('shows loading skeleton when products is undefined', () => {
    renderList(undefined);
    expect(screen.getByText('Cargando productos...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});

describe('ProductList — empty state', () => {
  it('shows empty state when products array is empty', () => {
    renderList([]);
    expect(screen.getByText('Sin productos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});

describe('ProductList — renders products', () => {
  it('renders all products grouped by category', () => {
    renderList(mockProducts);

    // Category headers
    expect(screen.getByText('Semillas/Cereal')).toBeInTheDocument();
    expect(screen.getByText('Frutos Secos')).toBeInTheDocument();
    expect(screen.getByText('Legumbres')).toBeInTheDocument();
    expect(screen.getByText('Fruta Deshidratada')).toBeInTheDocument();

    // Product names
    expect(screen.getByText('Chía')).toBeInTheDocument();
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('Maní')).toBeInTheDocument();
    expect(screen.getByText('Pasas')).toBeInTheDocument();
  });

  it('shows total product count', () => {
    renderList(mockProducts);
    // Text is split: <span>5</span> producto<span>s</span>
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('ProductList — search filter', () => {
  it('filters products by name (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'chía');

    // Chía should be visible
    expect(screen.getByText('Chía')).toBeInTheDocument();
    // Other products should NOT be visible
    expect(screen.queryByText('Almendras')).not.toBeInTheDocument();
    expect(screen.queryByText('Arroz')).not.toBeInTheDocument();
  });

  it('shows partial match results', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'al');

    // "Almendras" matches "al"
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    // Other products should not match
    expect(screen.queryByText('Chía')).not.toBeInTheDocument();
    expect(screen.queryByText('Arroz')).not.toBeInTheDocument();
  });

  it('shows updated count when filtering', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    // Total should show at start - text is split across elements
    expect(screen.getByText('5')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'chía');

    // Should show "1 de 5"
    expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/de/)).toBeInTheDocument();
  });

  it('clears search when clicking the X button', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'chía');
    expect(screen.queryByText('Almendras')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });

  it('shows empty search result state when no match', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'xyzzy');

    expect(screen.getByText(/xyzzy/)).toBeInTheDocument();
    expect(screen.getByText(/No hay productos que coincidan/)).toBeInTheDocument();
    expect(screen.queryByText('Chía')).not.toBeInTheDocument();
  });
});

describe('ProductList — availability filter', () => {
  it('shows only available products when toggle is on', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    await user.click(screen.getByRole('checkbox', { name: 'Filtrar solo productos disponibles' }));

    // Available: Chía, Arroz, Pasas (disponible = true)
    expect(screen.getByText('Chía')).toBeInTheDocument();
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('Pasas')).toBeInTheDocument();

    // Not available: Almendras, Maní (disponible = false)
    expect(screen.queryByText('Almendras')).not.toBeInTheDocument();
    expect(screen.queryByText('Maní')).not.toBeInTheDocument();
  });

  it('shows "mostrar todos" button when available-only yields all unavailable', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    // Search for something that's not available
    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'almendras');
    await user.click(screen.getByRole('checkbox', { name: 'Filtrar solo productos disponibles' }));

    // Should show "mostrar todos" button because all filtered results are excluded
    expect(screen.getByText('Mostrar todos')).toBeInTheDocument();
  });

  it('shows empty state when no available products and toggle is on with all unavailable', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    // Search for something that exists but is not available
    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'almendras');
    await user.click(screen.getByRole('checkbox', { name: 'Filtrar solo productos disponibles' }));

    // Almendras is not available, so no results when available-only is on
    expect(screen.getByText(/No hay productos disponibles que coincidan/)).toBeInTheDocument();
  });

  it('toggles available filter and search together', async () => {
    const user = userEvent.setup();
    renderList(mockProducts);

    // Filter by available only
    await user.click(screen.getByRole('checkbox', { name: 'Filtrar solo productos disponibles' }));
    // Within available, search for something that exists
    await user.type(screen.getByLabelText('Buscar productos por nombre'), 'pasas');

    expect(screen.getByText('Pasas')).toBeInTheDocument();
    expect(screen.queryByText('Chía')).not.toBeInTheDocument(); // Chía is available but doesn't match search
  });
});

describe('ProductList — keyboard shortcut', () => {
  it('focuses search input on Ctrl+/', () => {
    renderList(mockProducts);

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(screen.getByLabelText('Buscar productos por nombre')).toHaveFocus();
  });

  it('focuses search input on Cmd+/', () => {
    renderList(mockProducts);

    fireEvent.keyDown(window, { key: '/', metaKey: true });
    expect(screen.getByLabelText('Buscar productos por nombre')).toHaveFocus();
  });
});
