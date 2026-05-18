import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuoteHistory } from '../QuoteHistory';
import { getAllQuotes, deleteQuote } from '../../db/database';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Mock the database functions
vi.mock('../../db/database', () => ({
  getAllQuotes: vi.fn(),
  deleteQuote: vi.fn(),
}));

// Mock useToast
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  }),
}));

describe('QuoteHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should render empty state when no quotes exist', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue([]);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        expect(screen.getByText(/no hay cotizaciones guardadas/i)).toBeInTheDocument();
      });
    });

    it('should render link to navigate to cotizador in empty state', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue([]);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /ir al cotizador/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/cotizador');
      });
    });
  });

  describe('with quotes', () => {
    const mockQuotes = [
      {
        id: 1,
        fecha: new Date('2024-01-15T10:30:00'),
        items: [
          { id: 'item-1', productId: 1, nombre: 'ALMENDRA LAMINADA', formato: '11,34', cantidad: 2, precioKg: 9200 },
        ],
        totalNeto: 208416,
        iva: 39599,
        total: 247615,
      },
      {
        id: 2,
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

    it('should render quote cards when quotes exist', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/10 de enero de 2024/i)).toBeInTheDocument();
      });
    });

    it('should show number of items per quote', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        expect(screen.getByText(/1 ítem/i)).toBeInTheDocument();
        expect(screen.getByText(/2 ítems/i)).toBeInTheDocument();
      });
    });

    it('should show total for each quote', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        expect(screen.getByText(/\$247\.615/)).toBeInTheDocument();
        expect(screen.getByText(/\$35\.403/)).toBeInTheDocument();
      });
    });

    it('should show item names for each quote', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        // First quote items
        expect(screen.getByText(/ALMENDRA LAMINADA/i)).toBeInTheDocument();
        // Second quote items
        expect(screen.getByText(/Chía/i)).toBeInTheDocument();
        expect(screen.getByText(/Avéna/i)).toBeInTheDocument();
      });
    });

    it('should call deleteQuote when delete button is clicked and confirmed', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);
      vi.mocked(deleteQuote).mockResolvedValue(undefined);

      // Mock window.confirm
      const mockConfirm = vi.fn(() => true);
      vi.stubGlobal('confirm', mockConfirm);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
        fireEvent.click(deleteButtons[0]);
      });

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('¿Eliminar esta cotización?');
        expect(deleteQuote).toHaveBeenCalledWith(1);
      });

      vi.unstubAllGlobals();
    });

    it('should not call deleteQuote if user cancels', async () => {
      vi.mocked(getAllQuotes).mockResolvedValue(mockQuotes);

      // Mock window.confirm to return false
      const mockConfirm = vi.fn(() => false);
      vi.stubGlobal('confirm', mockConfirm);

      renderWithRouter(<QuoteHistory />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
        fireEvent.click(deleteButtons[0]);
      });

      expect(deleteQuote).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});