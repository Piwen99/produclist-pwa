import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListSends } from '../ListSends';
import { ToastProvider } from '../../hooks/ToastProvider';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import type { Repositories } from '../../data/ports';

const USER_ID = 'user-1';

function renderWithProviders(repos: Repositories) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DataProvider repos={repos} userId={USER_ID}>
          <ListSends />
        </DataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function seedListSends(repos: Repositories): Promise<unknown>[] {
  return [
    repos.listSends.create({
      fecha: new Date('2024-01-10T14:00:00'),
      cliente: 'María López',
      items: [{ nombre: 'Avéna', formato: '25', precioNeto: 750, precioBruto: 892 }],
    }),
    repos.listSends.create({
      fecha: new Date('2024-01-15T10:30:00'),
      cliente: 'Juan Pérez',
      items: [
        { nombre: 'ALMENDRA', formato: '11,34', precioNeto: 8000, precioBruto: 9520 },
        { nombre: 'Chía', formato: '25', precioNeto: 2800, precioBruto: 3332 },
      ],
    }),
  ];
}

describe('ListSends', () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories({ userId: USER_ID, isAdmin: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when there are no sent lists', async () => {
    renderWithProviders(repos);

    expect(await screen.findByText(/no hay listas enviadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument();
  });

  it('shows a distinct load-error state (not the empty state) when loading fails', async () => {
    vi.spyOn(repos.listSends, 'list').mockRejectedValue(new Error('boom'));
    renderWithProviders(repos);

    expect(
      await screen.findByText(/no se pudieron cargar las listas enviadas/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByText(/no hay listas enviadas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument();
  });

  it('re-runs the load when Reintentar is clicked', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(repos.listSends, 'list')
      .mockRejectedValueOnce(new Error('boom'));
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText(/no se pudieron cargar las listas enviadas/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('renders each sent list with client, date and item count', async () => {
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.getByText(/15 de enero de 2024/)).toBeInTheDocument();
    expect(screen.getByText(/10 de enero de 2024/)).toBeInTheDocument();
    expect(screen.getByText('2 ítems')).toBeInTheDocument();
    expect(screen.getByText('1 ítem')).toBeInTheDocument();
  });

  it('orders newest first and shows the total counter', async () => {
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText('Juan Pérez');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Juan Pérez');
    expect(rows[1]).toHaveTextContent('María López');
    expect(screen.getByText('2 listas')).toBeInTheDocument();
  });

  it('filters by client and updates the counter', async () => {
    const user = userEvent.setup();
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText('Juan Pérez');
    await user.type(screen.getByLabelText('Buscar listas enviadas por cliente'), 'juan');

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByText('María López')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  it('shows a distinct "Sin resultados" state when nothing matches', async () => {
    const user = userEvent.setup();
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText('Juan Pérez');
    await user.type(screen.getByLabelText('Buscar listas enviadas por cliente'), 'xyzzy');

    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
    expect(screen.queryByText(/No hay listas enviadas/i)).not.toBeInTheDocument();
    expect(screen.getByText('0 de 2')).toBeInTheDocument();
  });

  it('clears the search with the X button and restores all rows', async () => {
    const user = userEvent.setup();
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText('Juan Pérez');
    const input = screen.getByLabelText('Buscar listas enviadas por cliente');
    await user.type(input, 'juan');
    expect(screen.queryByText('María López')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('focuses the search input on Ctrl+/', async () => {
    await Promise.all(seedListSends(repos));
    renderWithProviders(repos);

    await screen.findByText('Juan Pérez');
    fireEvent.keyDown(window, { key: '/', ctrlKey: true });

    expect(screen.getByLabelText('Buscar listas enviadas por cliente')).toHaveFocus();
  });
});
