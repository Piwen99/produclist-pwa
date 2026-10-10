import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuoteHistory } from '../QuoteHistory';
import { ToastProvider } from '../../hooks/ToastProvider';
import { DataProvider } from '../../data/DataProvider';
import {
  createInMemoryClientsRepo,
  createInMemoryListSendsRepo,
  createInMemoryProductsRepo,
  createInMemoryQuotesRepo,
  createInMemoryRepositories,
  type Principal,
} from '../../data/testing/inMemoryRepos';
import type { Repositories } from '../../data/ports';
import type { SavedQuote } from '../../types/quote';

const USER_ID = 'user-1';

const mockQuotes: Omit<SavedQuote, 'id' | 'ownerId'>[] = [
  {
    fecha: new Date('2024-01-15T10:30:00'),
    cliente: 'Distribuidora Los Andes',
    items: [
      { id: 'item-1', productId: 1, nombre: 'ALMENDRA LAMINADA', formato: '11,34', cantidad: 2, precioKg: 9200 },
    ],
    totalNeto: 208416,
    iva: 39599,
    total: 247615,
  },
  {
    fecha: new Date('2024-01-10T14:00:00'),
    items: [
      { id: 'item-2', productId: 2, nombre: 'Chía', formato: '25', cantidad: 1, precioKg: 2800 },
      { id: 'item-3', productId: 3, nombre: 'Avéna', formato: '25', cantidad: 3, precioKg: 750 },
    ],
    totalNeto: 29750,
    iva: 5653,
    total: 35403,
  },
];

function renderWithProviders(repos: Repositories) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DataProvider repos={repos} userId={USER_ID}>
          <QuoteHistory />
        </DataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function seedQuotes(
  repos: Repositories,
  quotes: Omit<SavedQuote, 'id' | 'ownerId'>[],
): Promise<void> {
  for (const quote of quotes) {
    await repos.quotes.create(quote);
  }
}

describe('QuoteHistory', () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories({ userId: USER_ID, isAdmin: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('empty state', () => {
    it('should render empty state when no quotes exist', async () => {
      renderWithProviders(repos);

      expect(await screen.findByText(/no hay cotizaciones guardadas/i)).toBeInTheDocument();
    });

    it('should render link to navigate to cotizador in empty state', async () => {
      renderWithProviders(repos);

      const link = await screen.findByRole('link', { name: /ir al cotizador/i });
      expect(link).toHaveAttribute('href', '/cotizador');
    });
  });

  describe('with quotes', () => {
    it('should render quote cards when quotes exist', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText(/15 de enero de 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/10 de enero de 2024/i)).toBeInTheDocument();
    });

    it('should show number of items per quote', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText(/1 ítem/i)).toBeInTheDocument();
      expect(screen.getByText(/2 ítems/i)).toBeInTheDocument();
    });

    it('should show total for each quote', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText(/\$247\.615/)).toBeInTheDocument();
      expect(screen.getByText(/\$35\.403/)).toBeInTheDocument();
    });

    it('should show the client name without any click', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText('Distribuidora Los Andes')).toBeInTheDocument();
    });

    it('should show "Sin cliente" when a quote has no client', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText('Sin cliente')).toBeInTheDocument();
    });

    it('should show item names for each quote when expanded', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      await screen.findByText(/15 de enero de 2024/i);

      // Rows start collapsed: item detail is not present until expanded.
      expect(screen.queryByText(/ALMENDRA LAMINADA/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Distribuidora Los Andes/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sin cliente/i }));

      expect(screen.getByText(/ALMENDRA LAMINADA/i)).toBeInTheDocument();
      expect(screen.getByText(/Chía/i)).toBeInTheDocument();
      expect(screen.getByText(/Avéna/i)).toBeInTheDocument();
    });

    it('should delete a quote through the repo when confirmed', async () => {
      await seedQuotes(repos, mockQuotes);
      vi.stubGlobal('confirm', vi.fn(() => true));

      renderWithProviders(repos);

      await screen.findByText(/15 de enero de 2024/i);
      fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      await waitFor(() =>
        expect(screen.queryByText(/15 de enero de 2024/i)).not.toBeInTheDocument(),
      );
      expect(await repos.quotes.listOwn(USER_ID)).toHaveLength(1);
    });

    it('should not delete a quote if the user cancels', async () => {
      await seedQuotes(repos, mockQuotes);
      vi.stubGlobal('confirm', vi.fn(() => false));

      renderWithProviders(repos);

      await screen.findByText(/15 de enero de 2024/i);
      fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);

      expect(screen.getByText(/15 de enero de 2024/i)).toBeInTheDocument();
      expect(await repos.quotes.listOwn(USER_ID)).toHaveLength(2);
    });
  });

  describe('client search', () => {
    it('filters by client and updates the result counter', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      await screen.findByText('Distribuidora Los Andes');
      expect(screen.getByText(/2 cotizaciones/i)).toBeInTheDocument();

      const input = screen.getByRole('textbox', { name: /buscar cotizaciones por cliente/i });
      fireEvent.change(input, { target: { value: 'andes' } });

      expect(screen.getByText('1 de 2')).toBeInTheDocument();
      expect(screen.getByText('Distribuidora Los Andes')).toBeInTheDocument();
      expect(screen.queryByText('Sin cliente')).not.toBeInTheDocument();
    });

    it('shows the "sin resultados" state when nothing matches', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      await screen.findByText('Distribuidora Los Andes');

      const input = screen.getByRole('textbox', { name: /buscar cotizaciones por cliente/i });
      fireEvent.change(input, { target: { value: 'zzz' } });

      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
      expect(screen.getByText('0 de 2')).toBeInTheDocument();
      expect(screen.queryByTestId('quote-card-1')).not.toBeInTheDocument();
    });

    it('clears the search with the clear button', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      await screen.findByText('Distribuidora Los Andes');

      const input = screen.getByRole('textbox', { name: /buscar cotizaciones por cliente/i });
      fireEvent.change(input, { target: { value: 'zzz' } });
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));

      expect(screen.getByText('Sin cliente')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('focuses the search input with Ctrl+/', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      const input = await screen.findByRole('textbox', { name: /buscar cotizaciones por cliente/i });
      expect(input).not.toHaveFocus();

      fireEvent.keyDown(window, { key: '/', ctrlKey: true });

      expect(input).toHaveFocus();
    });
  });

  describe('expandable rows', () => {
    it('reveals item detail on expand and hides it on collapse', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      const toggle = await screen.findByRole('button', { name: /Distribuidora Los Andes/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/ALMENDRA LAMINADA/i)).not.toBeInTheDocument();

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/ALMENDRA LAMINADA/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Neto/i)).toBeInTheDocument();
      expect(screen.getByText(/IVA 19%/i)).toBeInTheDocument();

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/ALMENDRA LAMINADA/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Total Neto/i)).not.toBeInTheDocument();
    });

    it('links the toggle to its detail container via aria-controls', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      const toggle = await screen.findByRole('button', { name: /Distribuidora Los Andes/i });
      const detailId = toggle.getAttribute('aria-controls');
      expect(detailId).toBeTruthy();

      fireEvent.click(toggle);
      expect(document.getElementById(detailId as string)).toBeInTheDocument();
    });
  });

  describe('admin view', () => {
    it('hides delete for foreign quotes while keeping it for own quotes', async () => {
      const principal: Principal = { userId: USER_ID, isAdmin: true };
      const quotes = createInMemoryQuotesRepo(principal, [
        { ...mockQuotes[0], id: 1, ownerId: USER_ID },
        { ...mockQuotes[1], id: 2, ownerId: 'other-user' },
      ]);
      const listSends = createInMemoryListSendsRepo(principal);
      const adminRepos: Repositories = {
        products: createInMemoryProductsRepo(principal),
        quotes,
        listSends,
        clients: createInMemoryClientsRepo(quotes, listSends),
      };

      renderWithProviders(adminRepos);

      expect(await screen.findByText(/15 de enero de 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/10 de enero de 2024/i)).toBeInTheDocument();

      const ownCard = screen.getByTestId('quote-card-1');
      const foreignCard = screen.getByTestId('quote-card-2');

      expect(within(ownCard).getByRole('button', { name: /eliminar cotización/i })).toBeInTheDocument();
      expect(within(foreignCard).queryByRole('button', { name: /eliminar cotización/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /eliminar cotización/i })).toHaveLength(1);
    });
  });
});
