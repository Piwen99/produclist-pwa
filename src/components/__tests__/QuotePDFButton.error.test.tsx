import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuotePDFButton } from '../QuotePDFButton';
import type { QuoteItem, QuoteTotals } from '../../types/quote';

vi.mock('../../pdf/QuotePDFDocument', () => {
  throw new Error('boom');
});

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuotePDFButton error recovery', () => {
  it('shows an enabled refresh button when the PDF module cannot be imported', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<QuotePDFButton items={items} totals={totals} />);

    const button = await screen.findByRole('button', { name: /actualizar pdf/i });
    expect(button).toBeEnabled();
  });
});
