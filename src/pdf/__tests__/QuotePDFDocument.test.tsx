import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QuotePDFDocument } from '../QuotePDFDocument';
import type { QuoteItem, QuoteTotals } from '../../types/quote';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({
    children,
  }: {
    children: (state: { loading: boolean; error: Error | null }) => ReactNode;
  }) => children({ loading: false, error: null }),
}));

const items: QuoteItem[] = [
  {
    id: 'item-1',
    productId: 1,
    nombre: 'Almendra Laminada',
    formato: '11,34',
    cantidad: 10,
    precioKg: 100,
  },
];

const totals: QuoteTotals = {
  totalKg: 113.4,
  subtotal: 11340,
  iva: 2155,
  total: 13495,
};

const zeroTotals: QuoteTotals = { totalKg: 0, subtotal: 0, iva: 0, total: 0 };

describe('QuotePDFDocument', () => {
  it('renders the product name, formato and quantity', () => {
    render(<QuotePDFDocument items={items} totals={totals} />);

    expect(screen.getByText('Almendra Laminada')).toBeInTheDocument();
    expect(screen.getByText('11,34')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('formats prices and line subtotals with formatCurrency', () => {
    render(<QuotePDFDocument items={items} totals={totals} />);

    expect(screen.getAllByText('$100').length).toBeGreaterThan(0);
    // 11.34 kg * 10 units * $100/kg = $11.340 (line subtotal + Subtotal Neto)
    expect(screen.getAllByText('$11.340').length).toBeGreaterThan(0);
  });

  it('renders all four totals', () => {
    render(<QuotePDFDocument items={items} totals={totals} />);

    expect(screen.getByText('Total kg')).toBeInTheDocument();
    expect(screen.getByText('113,40 kg')).toBeInTheDocument();
    expect(screen.getByText('Subtotal Neto')).toBeInTheDocument();
    expect(screen.getAllByText('$11.340').length).toBeGreaterThan(0);
    expect(screen.getByText('IVA 19%')).toBeInTheDocument();
    expect(screen.getByText('$2.155')).toBeInTheDocument();
    expect(screen.getByText('Total a pagar')).toBeInTheDocument();
    expect(screen.getByText('$13.495')).toBeInTheDocument();
  });

  it('prints the client when provided', () => {
    render(<QuotePDFDocument items={items} totals={totals} cliente="Almacén Los Andes" />);

    expect(screen.getByText(/Cliente: Almacén Los Andes/)).toBeInTheDocument();
  });

  it('omits the client line entirely when absent', () => {
    render(<QuotePDFDocument items={items} totals={totals} />);

    expect(screen.queryByText(/Cliente:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it('shows "Sin productos" when there are no items', () => {
    render(<QuotePDFDocument items={[]} totals={zeroTotals} />);

    expect(screen.getByText('Sin productos')).toBeInTheDocument();
  });

  it('does not render NaN for an invalid formato', () => {
    const invalid: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Producto', formato: 'abc', cantidad: 2, precioKg: 500 },
    ];
    render(<QuotePDFDocument items={invalid} totals={zeroTotals} />);

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});