import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteProductSelector } from '../QuoteProductSelector';
import type { Product } from '../../types/product';

// Mock the Dexie hook
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

import { useLiveQuery } from 'dexie-react-hooks';

const allProducts: Product[] = [
  { id: 1, nombre: 'Almendras', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 15000, disponible: true },
  { id: 2, nombre: 'Chía', categoria: 'Semillas/Cereal', formato: '1,5', precioNeto: 9200, disponible: true },
  { id: 3, nombre: 'Maní', categoria: 'Frutos Secos', formato: '2', precioNeto: 4000, disponible: false },
  { id: 4, nombre: 'Pasas', categoria: 'Fruta Deshidratada', formato: '0,5', precioNeto: 2500, disponible: true },
];

// Mock returns ALL products (available + unavailable), as the real Dexie
// query would — the component itself must filter by `disponible`.
const mockOnSelect = vi.fn();
const mockOnClose = vi.fn();

function setup(mockData: Product[] | undefined = allProducts) {
  (useLiveQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockData);
  return render(<QuoteProductSelector onSelect={mockOnSelect} onClose={mockOnClose} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuoteProductSelector', () => {
  it('should render the modal when open', () => {
    setup();
    expect(screen.getByText('Seleccionar Producto')).toBeInTheDocument();
  });

  it('should display available products', () => {
    setup();
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
    expect(screen.getByText('Pasas')).toBeInTheDocument();
  });

  it('should display unavailable products too (all products are quotable)', () => {
    setup();
    // Maní is marked unavailable, but the user deliberately wants to be able
    // to quote every product regardless of `disponible`.
    expect(screen.getByText('Maní')).toBeInTheDocument();
  });

  it('should display product formato next to name', () => {
    setup();
    // Should see formato near the product name
    const almondsButton = screen.getByRole('button', { name: /almendras/i });
    expect(almondsButton).toHaveTextContent('11,34 kg');
  });

  it('should call onSelect when a product is clicked', () => {
    setup();
    fireEvent.click(screen.getByText('Almendras'));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(allProducts[0]);
  });

  it('should filter products by search term', () => {
    setup();
    const searchInput = screen.getByPlaceholderText('Buscar productos…');
    // Search for "al" - should match "Almendras"
    fireEvent.change(searchInput, { target: { value: 'al' } });
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.queryByText('Chía')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasas')).not.toBeInTheDocument();
  });

  it('should show no results message when search has no matches', () => {
    setup();
    const searchInput = screen.getByPlaceholderText('Buscar productos…');
    fireEvent.change(searchInput, { target: { value: 'xyz' } });
    expect(screen.getByText(/No hay productos que coincidan/)).toBeInTheDocument();
  });

  it('should show empty state when no available products', () => {
    setup([]);
    expect(screen.getByText('No hay productos disponibles')).toBeInTheDocument();
  });

  it('should call onSelect with correct product data including formato', () => {
    setup();
    fireEvent.click(screen.getByText('Chía'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Chía',
        formato: '1,5',
        disponible: true,
      })
    );
  });

  it('should clear search and show all when X is clicked', () => {
    setup();
    const searchInput = screen.getByPlaceholderText('Buscar productos…');
    fireEvent.change(searchInput, { target: { value: 'al' } });
    expect(screen.getByText('Almendras')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });
});