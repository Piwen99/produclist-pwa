import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('lists both a sent list and a quote in the document history, newest first', async () => {
    await repos.listSends.create({
      cliente: 'Juan',
      fecha: new Date(2026, 8, 1),
      items: [
        { nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 },
        { nombre: 'NUEZ', formato: '5,00', precioNeto: 12000, precioBruto: 14280 },
      ],
    });
    await repos.quotes.create({
      cliente: 'Juan',
      fecha: new Date(2026, 8, 20),
      items: [
        { id: 'i1', productId: 1, nombre: 'ALMENDRA', formato: '11,34', cantidad: 1, precioKg: 9500 },
      ],
      totalNeto: 9500,
      iva: 1805,
      total: 11305,
    });

    renderWithProvider(repos);

    const heading = await screen.findByText('Historial de documentos');
    const section = heading.closest('section') as HTMLElement;
    const rows = within(section).getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    // The quote (2026-09-20) is newer than the sent list (2026-09-01).
    expect(rows[0]).toHaveTextContent('Cotización');
    expect(rows[0]).toHaveTextContent('20/09/2026');
    expect(rows[0]).toHaveTextContent('1 ítem');
    expect(rows[0]).toHaveTextContent('$11.305');
    expect(rows[1]).toHaveTextContent('Lista enviada');
    expect(rows[1]).toHaveTextContent('01/09/2026');
    expect(rows[1]).toHaveTextContent('2 ítems');
    // Sent lists carry no stored total.
    expect(rows[1]).not.toHaveTextContent('$');
  });

  it('updates the document history and price table when the selected client changes', async () => {
    await repos.listSends.create({
      cliente: 'Juan',
      fecha: new Date('2026-09-01'),
      items: [{ nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 }],
    });
    await repos.quotes.create({
      cliente: 'Maria',
      fecha: new Date('2026-09-25'),
      items: [
        { id: 'i1', productId: 2, nombre: 'TOMATE', formato: '1,00', cantidad: 1, precioKg: 2000 },
        { id: 'i2', productId: 3, nombre: 'PAPA', formato: '2,00', cantidad: 1, precioKg: 1000 },
        { id: 'i3', productId: 4, nombre: 'CEBOLLA', formato: '1,00', cantidad: 1, precioKg: 1500 },
      ],
      totalNeto: 6000,
      iva: 1140,
      total: 7140,
    });

    const user = userEvent.setup();
    renderWithProvider(repos);

    // The first client alphabetically is Juan.
    expect(await screen.findByText('ALMENDRA')).toBeInTheDocument();
    expect(screen.getByText('Lista enviada')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Cliente'), 'Maria');

    expect(await screen.findByText('TOMATE')).toBeInTheDocument();
    expect(screen.queryByText('ALMENDRA')).not.toBeInTheDocument();
    expect(screen.queryByText('Lista enviada')).not.toBeInTheDocument();
    expect(screen.getByText('Cotización')).toBeInTheDocument();
    expect(screen.getByText(/3 ítems/)).toBeInTheDocument();
    expect(screen.getByText('$7.140')).toBeInTheDocument();
  });

  it('shows a per-client empty state when the client has no documents', async () => {
    repos.clients.listNames = async () => ['Cliente sin documentos'];

    renderWithProvider(repos);

    expect(await screen.findByText('Sin documentos para este cliente.')).toBeInTheDocument();
    expect(screen.getByText('No hay precios registrados para este cliente.')).toBeInTheDocument();
  });
});
