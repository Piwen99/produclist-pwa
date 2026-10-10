import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientPrices } from '../ClientPrices';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { Repositories } from '../../data/ports';
import type { ListSend } from '../../types/listSend';

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

  it('renders a document row for a sent list with no id using a fallback key', async () => {
    repos.clients.listNames = async () => ['Juan'];
    // A persisted row must carry an id, but guard the fallback branch anyway.
    repos.listSends.list = async () => [
      {
        fecha: new Date(2026, 8, 5),
        cliente: 'Juan',
        items: [
          { nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 },
          { nombre: 'NUEZ', formato: '5,00', precioNeto: 12000, precioBruto: 14280 },
        ],
      },
    ];
    repos.quotes.list = async () => [];

    renderWithProvider(repos);

    const heading = await screen.findByText('Historial de documentos');
    const section = heading.closest('section') as HTMLElement;
    const rows = within(section).getAllByRole('listitem');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Lista enviada');
    expect(rows[0]).toHaveTextContent('05/09/2026');
    expect(rows[0]).toHaveTextContent('2 ítems');
  });

  it('renders a sent list with id null using the index fallback key', async () => {
    repos.clients.listNames = async () => ['Juan'];
    // A degraded row can carry `null` even though the domain type is
    // `id?: number`; both must take the index fallback branch.
    repos.listSends.list = async () => [
      {
        id: null,
        fecha: new Date(2026, 8, 5),
        cliente: 'Juan',
        items: [
          { nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 },
          { nombre: 'NUEZ', formato: '5,00', precioNeto: 12000, precioBruto: 14280 },
        ],
      } as unknown as ListSend,
    ];
    repos.quotes.list = async () => [];

    renderWithProvider(repos);

    const heading = await screen.findByText('Historial de documentos');
    const section = heading.closest('section') as HTMLElement;
    const rows = within(section).getAllByRole('listitem');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Lista enviada');
    expect(rows[0]).toHaveTextContent('05/09/2026');
    expect(rows[0]).toHaveTextContent('2 ítems');
  });

  it('renders two null-id sent lists at different positions without colliding', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    repos.clients.listNames = async () => ['Juan'];
    // Both rows would produce the key `lista-null` without the null guard.
    repos.listSends.list = async () => [
      {
        id: null,
        fecha: new Date(2026, 8, 5),
        cliente: 'Juan',
        items: [{ nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 }],
      } as unknown as ListSend,
      {
        id: null,
        fecha: new Date(2026, 8, 10),
        cliente: 'Juan',
        items: [
          { nombre: 'NUEZ', formato: '5,00', precioNeto: 12000, precioBruto: 14280 },
          { nombre: 'PISTACHO', formato: '1,00', precioNeto: 20000, precioBruto: 23800 },
        ],
      } as unknown as ListSend,
    ];
    repos.quotes.list = async () => [];

    renderWithProvider(repos);

    const heading = await screen.findByText('Historial de documentos');
    const section = heading.closest('section') as HTMLElement;
    const rows = within(section).getAllByRole('listitem');

    // Both null-id rows must render; a duplicated `lista-null` key makes React
    // warn and reconcile one of them away.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('10/09/2026');
    expect(rows[0]).toHaveTextContent('2 ítems');
    expect(rows[1]).toHaveTextContent('05/09/2026');
    expect(rows[1]).toHaveTextContent('1 ítem');

    const duplicateKeyWarning = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    );
    expect(duplicateKeyWarning).toBe(false);

    errorSpy.mockRestore();
  });

  it('renders two NaN-id sent lists at different positions without colliding', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    repos.clients.listNames = async () => ['Juan'];
    // `NaN` is a `number`, so it satisfies `id?: number` but is not a real id;
    // both rows would produce the key `lista-NaN` without the finite-number guard.
    repos.listSends.list = async () => [
      {
        id: NaN,
        fecha: new Date(2026, 8, 5),
        cliente: 'Juan',
        items: [{ nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 }],
      },
      {
        id: NaN,
        fecha: new Date(2026, 8, 10),
        cliente: 'Juan',
        items: [
          { nombre: 'NUEZ', formato: '5,00', precioNeto: 12000, precioBruto: 14280 },
          { nombre: 'PISTACHO', formato: '1,00', precioNeto: 20000, precioBruto: 23800 },
        ],
      },
    ];
    repos.quotes.list = async () => [];

    renderWithProvider(repos);

    const heading = await screen.findByText('Historial de documentos');
    const section = heading.closest('section') as HTMLElement;
    const rows = within(section).getAllByRole('listitem');

    // Both NaN-id rows must render; a duplicated `lista-NaN` key makes React
    // warn and reconcile one of them away.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('10/09/2026');
    expect(rows[0]).toHaveTextContent('2 ítems');
    expect(rows[1]).toHaveTextContent('05/09/2026');
    expect(rows[1]).toHaveTextContent('1 ítem');

    const duplicateKeyWarning = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    );
    expect(duplicateKeyWarning).toBe(false);

    errorSpy.mockRestore();
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
