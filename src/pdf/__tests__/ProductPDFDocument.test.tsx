import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProductPDFDocument } from '../ProductPDFDocument';
import type { Product } from '../../types/product';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // The style is surfaced as a data attribute so tests can assert on the
  // availability tint, which is carried by a View style and not by any text.
  View: ({ children, style }: { children?: ReactNode; style?: unknown }) => (
    <div data-style={JSON.stringify(style ?? null)}>{children}</div>
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({
    children,
  }: {
    children: (state: { loading: boolean; error: Error | null }) => ReactNode;
  }) => children({ loading: false, error: null }),
}));

const products: Product[] = [
  {
    id: 1,
    nombre: 'Almendras',
    categoria: 'Frutos Secos',
    formato: '11,34',
    precioNeto: 15000,
    disponible: true,
  },
  {
    id: 2,
    nombre: 'Maní',
    categoria: 'Frutos Secos',
    formato: '2',
    precioNeto: 4000,
    disponible: false,
  },
];

describe('ProductPDFDocument', () => {
  it('renders every product passed in through the prop, available or not', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Maní')).toBeInTheDocument();
  });

  it('counts every product passed in, available or not', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getByText(/2 productos/)).toBeInTheDocument();
  });

  it('renders an all-unavailable list and counts every product', () => {
    const unavailable = products.map((product) => ({ ...product, disponible: false }));
    render(<ProductPDFDocument products={unavailable} />);

    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.getByText('Maní')).toBeInTheDocument();
    expect(screen.getByText(/2 productos/)).toBeInTheDocument();
  });

  it('renders an empty document when the prop is omitted', () => {
    render(<ProductPDFDocument />);

    expect(screen.getByText(/0 productos/)).toBeInTheDocument();
    expect(screen.queryByText('Almendras')).not.toBeInTheDocument();
  });

  it('labels an available row as Disponible', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getAllByText('Disponible')).toHaveLength(1);
  });

  it('labels an unavailable row as No disponible', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getAllByText('No disponible')).toHaveLength(1);
  });

  it('labels every row of an all-unavailable list as No disponible', () => {
    const unavailable = products.map((product) => ({ ...product, disponible: false }));
    render(<ProductPDFDocument products={unavailable} />);

    expect(screen.getAllByText('No disponible')).toHaveLength(2);
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
  });

  it('tints the unavailable rows only', () => {
    const { container } = render(<ProductPDFDocument products={products} />);

    expect(container.querySelectorAll('[data-style*="faeeee"]')).toHaveLength(1);
  });
});
