import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientPrices } from '../ClientPrices';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { Repositories } from '../../data/ports';

const USER_ID = 'user-1';

function renderWithProvider(repos: Repositories) {
  return render(
    <DataProvider repos={repos} userId={USER_ID}>
      <ClientPrices />
    </DataProvider>,
  );
}

describe('ClientPrices', () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories({ userId: USER_ID, isAdmin: false });
  });

  it('shows an empty state when there are no clients', async () => {
    renderWithProvider(repos);
    expect(await screen.findByText(/todavía no hay clientes/i)).toBeInTheDocument();
  });

  it('shows the last price per product for the selected client', async () => {
    await repos.listSends.create({
      cliente: 'Juan',
      fecha: new Date('2026-09-01'),
      items: [{ nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 }],
    });
    await repos.quotes.create({
      cliente: 'Juan',
      fecha: new Date('2026-09-20'),
      items: [
        { id: 'i1', productId: 1, nombre: 'ALMENDRA', formato: '11,34', cantidad: 1, precioKg: 9500 },
      ],
      totalNeto: 9500,
      iva: 1805,
      total: 11305,
    });

    renderWithProvider(repos);

    expect(await screen.findByText('ALMENDRA')).toBeInTheDocument();
    // The quote is more recent, so its price wins.
    expect(screen.getByText(/9\.500/)).toBeInTheDocument();
  });
});
