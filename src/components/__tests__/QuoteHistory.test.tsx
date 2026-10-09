import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    it('should show item names for each quote', async () => {
      await seedQuotes(repos, mockQuotes);
      renderWithProviders(repos);

      expect(await screen.findByText(/ALMENDRA LAMINADA/i)).toBeInTheDocument();
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

      const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
      expect(deleteButtons).toHaveLength(1);
      expect(
        screen.getByText(/15 de enero de 2024/i).closest('div')
      ).toContainElement(deleteButtons[0]);
      expect(
        screen.getByText(/10 de enero de 2024/i).closest('div')
      ).not.toContainElement(deleteButtons[0]);
    });
  });
});
