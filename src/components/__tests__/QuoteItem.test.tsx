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

  it('marks a line without a format instead of pricing it at $0 (issue #94)', () => {
    render(<QuoteItem item={{ ...mockItem, formato: '' }} {...handlers} />);

    expect(screen.getByText('Sin formato')).toBeInTheDocument();
    // A $0 here would look like a real amount to the seller and the client.
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('rounds each line to whole pesos (issue #95)', () => {
    render(
      <QuoteItem
        item={{ ...mockItem, formato: '11,33', cantidad: 1, precioKg: 1001 }}
        {...handlers}
      />,
    );

    expect(screen.getByText('$11.341')).toBeInTheDocument();
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

  it('should allow cantidad of 0', () => {
    render(<QuoteItem item={mockItem} {...handlers} />);
    const input = screen.getByLabelText('Cantidad');
    fireEvent.change(input, { target: { value: '0' } });
    expect(handlers.onUpdateQty).toHaveBeenCalledWith('test-id-123', 0);
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