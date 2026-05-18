import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Cotizador } from '../Cotizador';
import { ToastProvider } from '../../hooks/useToast';
import type { QuoteItem } from '../../types/quote';

const mockHandlers = {
  onAddProduct: vi.fn(),
  onUpdateQty: vi.fn(),
  onUpdatePrecioKg: vi.fn(),
  onRemove: vi.fn(),
};

function renderCotizador(items: QuoteItem[] = [], totals = { totalKg: 0, subtotal: 0, iva: 0, total: 0 }) {
  return render(
    <ToastProvider>
      <Cotizador items={items} totals={totals} {...mockHandlers} />
    </ToastProvider>
  );
}

describe('Cotizador', () => {
  it('should render "Cotizador" header', () => {
    renderCotizador();
    expect(screen.getByRole('heading', { name: 'Cotizador' })).toBeInTheDocument();
  });

  it('should render "Agregar producto" button', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /agregar producto/i })).toBeInTheDocument();
  });

  it('should open product selector modal when "Agregar producto" button is clicked', () => {
    renderCotizador();
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByText('Seleccionar Producto')).toBeInTheDocument();
  });

  it('should render empty state when no items', () => {
    renderCotizador();
    expect(screen.getByText(/agregá productos para comenzar/i)).toBeInTheDocument();
  });

  it('should not render empty state when items exist', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
    ];
    renderCotizador(items, { totalKg: 11.34, subtotal: 1134, iva: 215, total: 1349 });
    expect(screen.queryByText(/agregá productos para comenzar/i)).not.toBeInTheDocument();
  });

  it('should render QuoteItem for each item', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
      { id: 'item-2', productId: 2, nombre: 'Chía', formato: '25', cantidad: 2, precioKg: 200 },
    ];
    renderCotizador(items, { totalKg: 61.34, subtotal: 12268, iva: 2331, total: 14599 });
    expect(screen.getByText('Almendra')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });

  it('should display total kg section', () => {
    renderCotizador([], { totalKg: 113.4, subtotal: 0, iva: 0, total: 0 });
    expect(screen.getByText(/total kg/i)).toBeInTheDocument();
    expect(screen.getByText(/113,40 kg/i)).toBeInTheDocument();
  });

  it('should display subtotal section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 23840, iva: 0, total: 0 });
    expect(screen.getByText(/subtotal neto/i)).toBeInTheDocument();
  });

  it('should display IVA 19% section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 0, iva: 4530, total: 0 });
    expect(screen.getByText(/iva 19%/i)).toBeInTheDocument();
  });

  it('should display total a pagar section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 0, iva: 0, total: 28370 });
    expect(screen.getByText(/total a pagar/i)).toBeInTheDocument();
    expect(screen.getByText('$28.370')).toBeInTheDocument();
  });

  it('should render QuoteShareButton', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /copiar cotización/i })).toBeInTheDocument();
  });

  it('should render Guardar cotización button', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /guardar cotización/i })).toBeInTheDocument();
  });
});