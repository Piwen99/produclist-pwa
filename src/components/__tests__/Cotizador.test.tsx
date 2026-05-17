import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Cotizador } from '../Cotizador';
import type { QuoteItem } from '../../types/quote';

const mockHandlers = {
  onAddProduct: vi.fn(),
  onUpdateQty: vi.fn(),
  onUpdatePrecioKg: vi.fn(),
  onRemove: vi.fn(),
};

describe('Cotizador', () => {
  it('should render "Cotizador" header', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByRole('heading', { name: 'Cotizador' })).toBeInTheDocument();
  });

  it('should render "Agregar producto" button', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByRole('button', { name: /agregar producto/i })).toBeInTheDocument();
  });

  it('should open product selector modal when "Agregar producto" button is clicked', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByText('Seleccionar Producto')).toBeInTheDocument();
  });

  it('should render empty state when no items', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByText(/agregá productos para comenzar/i)).toBeInTheDocument();
  });

  it('should not render empty state when items exist', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
    ];
    render(<Cotizador items={items} totals={{ totalKg: 11.34, subtotal: 1134, iva: 215, total: 1349 }} {...mockHandlers} />);
    expect(screen.queryByText(/agregá productos para comenzar/i)).not.toBeInTheDocument();
  });

  it('should render QuoteItem for each item', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
      { id: 'item-2', productId: 2, nombre: 'Chía', formato: '25', cantidad: 2, precioKg: 200 },
    ];
    render(<Cotizador items={items} totals={{ totalKg: 61.34, subtotal: 12268, iva: 2331, total: 14599 }} {...mockHandlers} />);
    expect(screen.getByText('Almendra')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });

  it('should display total kg section', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 113.4, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByText(/total kg/i)).toBeInTheDocument();
    expect(screen.getByText(/113,40 kg/i)).toBeInTheDocument();
  });

  it('should display subtotal section', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 23840, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByText(/subtotal neto/i)).toBeInTheDocument();
  });

  it('should display IVA 19% section', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 4530, total: 0 }} {...mockHandlers} />);
    expect(screen.getByText(/iva 19%/i)).toBeInTheDocument();
  });

  it('should display total a pagar section', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 28370 }} {...mockHandlers} />);
    expect(screen.getByText(/total a pagar/i)).toBeInTheDocument();
    expect(screen.getByText('$28.370')).toBeInTheDocument();
  });

  it('should render QuoteShareButton', () => {
    render(<Cotizador items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} {...mockHandlers} />);
    expect(screen.getByRole('button', { name: /copiar cotización/i })).toBeInTheDocument();
  });
});