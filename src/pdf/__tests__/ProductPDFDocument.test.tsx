import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProductPDFDocument } from '../ProductPDFDocument';
import type { Product } from '../../types/product';

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

// The document must render from its `products` prop only. If it still reaches
// for a live query this mock makes the render throw, which is the RED signal.
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => {
    throw new Error('ProductPDFDocument must not use useLiveQuery');
  },
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
  it('renders the available products passed in through the prop', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getByText('Almendras')).toBeInTheDocument();
    expect(screen.queryByText('Maní')).not.toBeInTheDocument();
  });

  it('excludes unavailable products from the count', () => {
    render(<ProductPDFDocument products={products} />);

    expect(screen.getByText(/1 productos/)).toBeInTheDocument();
  });

  it('renders an empty document when the prop is omitted', () => {
    render(<ProductPDFDocument />);

    expect(screen.getByText(/0 productos/)).toBeInTheDocument();
    expect(screen.queryByText('Almendras')).not.toBeInTheDocument();
  });
});
