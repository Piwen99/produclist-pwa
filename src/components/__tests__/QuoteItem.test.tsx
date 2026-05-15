import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteItem } from '../QuoteItem';
import type { QuoteItem as QuoteItemType } from '../../types/quote';

const mockItem: QuoteItemType = {
  id: 'test-id-123',
  productId: 1,
  nombre: 'Almendras',
  formato: '11,34',
  cantidad: 5,
  precioKg: 15000,
};

const handlers = {
  onUpdateQty: vi.fn(),
  onUpdatePrecioKg: vi.fn(),
  onRemove: vi.fn(),
};

describe('QuoteItem', () => {
  it('should render item name', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    expect(screen.getByText('Almendras')).toBeInTheDocument();
  });

  it('should render item formato', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    // Formato is "11,34" displayed with " kg" suffix
    expect(screen.getByText(/11,34/)).toBeInTheDocument();
  });

  it('should render cantidad input with correct value', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Cantidad');
    expect(input).toHaveValue(5);
  });

  it('should render precioKg input with correct value', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Precio por kg');
    expect(input).toHaveValue(15000);
  });

  it('should calculate and display subtotal', () => {
    // totalKg = 11.34 * 5 = 56.7
    // subtotal = 56.7 * 15000 = 850500
    render(<QuoteItem item={mockItem} {...handlers} />);
    // Look for formatted subtotal
    expect(screen.getByText(/\$850\.500/)).toBeInTheDocument();
  });

  it('should call onUpdateQty when cantidad changes', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Cantidad');
    fireEvent.change(input, { target: { value: '10' } });
    expect(handlers.onUpdateQty).toHaveBeenCalledWith('test-id-123', 10);
  });

  it('should call onUpdatePrecioKg when precioKg changes', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Precio por kg');
    fireEvent.change(input, { target: { value: '20000' } });
    expect(handlers.onUpdatePrecioKg).toHaveBeenCalledWith('test-id-123', 20000);
  });

  it('should call onRemove when remove button is clicked', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(handlers.onRemove).toHaveBeenCalledWith('test-id-123');
  });

  it('should enforce minimum cantidad of 1', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Cantidad');
    fireEvent.change(input, { target: { value: '0' } });
    // When quantity becomes 0, it should be reset to 1
    expect(handlers.onUpdateQty).toHaveBeenCalledWith('test-id-123', 1);
  });

  it('should display zero subtotal when precioKg is 0', () => {
    const zeroPriceItem = { ...mockItem, precioKg: 0 };
    render(<QuoteItem item={zeroPriceItem} {...handlers} />);
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
  });

  it('should display zero subtotal when cantidad is 0', () => {
    const zeroQtyItem = { ...mockItem, cantidad: 0 };
    render(<QuoteItem item={zeroQtyItem} {...handlers} />);
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
  });
});