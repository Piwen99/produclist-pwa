import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientPrices } from '../ClientPrices';
import { db, saveListSend, saveQuote } from '../../db/database';

describe('ClientPrices', () => {
  beforeEach(async () => {
    await db.listSends.clear();
    await db.quotes.clear();
  });

  it('shows an empty state when there are no clients', async () => {
    render(<ClientPrices />);
    expect(await screen.findByText(/todavía no hay clientes/i)).toBeInTheDocument();
  });

  it('shows the last price per product for the selected client', async () => {
    await saveListSend({
      cliente: 'Juan',
      fecha: new Date('2026-09-01'),
      items: [{ nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 }],
    });
    await saveQuote({
      cliente: 'Juan',
      fecha: new Date('2026-09-20'),
      items: [
        { id: 'i1', productId: 1, nombre: 'ALMENDRA', formato: '11,34', cantidad: 1, precioKg: 9500 },
      ],
      totalNeto: 9500,
      iva: 1805,
      total: 11305,
    });

    render(<ClientPrices />);

    expect(await screen.findByText('ALMENDRA')).toBeInTheDocument();
    // The quote is more recent, so its price wins.
    expect(screen.getByText(/9\.500/)).toBeInTheDocument();
  });
});
