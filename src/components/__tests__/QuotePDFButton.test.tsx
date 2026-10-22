import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QuotePDFButton } from '../QuotePDFButton';
import type { QuoteItem, QuoteTotals } from '../../types/quote';

// The component lazy-loads the PDF document module, which re-exports
// PDFDownloadLink. Mocking that module keeps the lazy path under test while
// removing the cost of transforming the real PDF document on first import,
// which timed out under parallel load (#102).
vi.mock('../../pdf/QuotePDFDocument', () => ({
  QuotePDFDocument: () => null,
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

describe('QuotePDFButton', () => {
  it('lazy-loads the PDF module and renders the export button', async () => {
    render(<QuotePDFButton items={items} totals={totals} />);

    const button = await screen.findByRole('button', { name: /exportar pdf/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('is disabled when there are no items', async () => {
    render(<QuotePDFButton items={[]} totals={zeroTotals} />);

    const button = await screen.findByRole('button', { name: /exportar pdf/i });
    expect(button).toBeDisabled();
  });

  it('honors the external disabled prop', async () => {
    render(<QuotePDFButton items={items} totals={totals} disabled />);

    const button = await screen.findByRole('button', { name: /exportar pdf/i });
    expect(button).toBeDisabled();
  });
});