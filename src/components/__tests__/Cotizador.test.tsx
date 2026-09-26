import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Cotizador } from '../Cotizador';
import { ToastProvider } from '../../hooks/ToastProvider';
import type { QuoteItem } from '../../types/quote';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({
    children,
  }: {
    children: (state: { loading: boolean; error: Error | null }) => ReactNode;
  }) => children({ loading: false, error: null }),
}));

const mockHandlers = {
  onAddProduct: vi.fn(),
  onUpdateQty: vi.fn(),
  onUpdatePrecioKg: vi.fn(),
  onRemove: vi.fn(),
};

function renderCotizador(items: QuoteItem[] = [], totals = { totalKg: 0, subtotal: 0, iva: 0, total: 0 }) {
  return render(
    <ToastProvider>
      <Cotizador items={items} totals={totals} {...mockHandlers} />
    </ToastProvider>
  );
}

describe('Cotizador', () => {
  it('should render "Cotizador" header', () => {
    renderCotizador();
    expect(screen.getByRole('heading', { name: 'Cotizador' })).toBeInTheDocument();
  });

  it('should render "Agregar producto" button', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /agregar producto/i })).toBeInTheDocument();
  });

  it('should open product selector modal when "Agregar producto" button is clicked', () => {
    renderCotizador();
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    // Exactly one heading: the dialog owns its title, Cotizador no longer renders one.
    const headings = screen.getAllByRole('heading', { name: 'Seleccionar Producto' });
    expect(headings).toHaveLength(1);
  });

  it('should render empty state when no items', () => {
    renderCotizador();
    expect(screen.getByText(/agregá productos para comenzar/i)).toBeInTheDocument();
  });

  it('should not render empty state when items exist', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
    ];
    renderCotizador(items, { totalKg: 11.34, subtotal: 1134, iva: 215, total: 1349 });
    expect(screen.queryByText(/agregá productos para comenzar/i)).not.toBeInTheDocument();
  });

  it('should render QuoteItem for each item', () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
      { id: 'item-2', productId: 2, nombre: 'Chía', formato: '25', cantidad: 2, precioKg: 200 },
    ];
    renderCotizador(items, { totalKg: 61.34, subtotal: 12268, iva: 2331, total: 14599 });
    expect(screen.getByText('Almendra')).toBeInTheDocument();
    expect(screen.getByText('Chía')).toBeInTheDocument();
  });

  it('should display total kg section', () => {
    renderCotizador([], { totalKg: 113.4, subtotal: 0, iva: 0, total: 0 });
    expect(screen.getByText(/total kg/i)).toBeInTheDocument();
    expect(screen.getByText(/113,40 kg/i)).toBeInTheDocument();
  });

  it('should display subtotal section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 23840, iva: 0, total: 0 });
    expect(screen.getByText(/subtotal neto/i)).toBeInTheDocument();
  });

  it('should display IVA 19% section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 0, iva: 4530, total: 0 });
    expect(screen.getByText(/iva 19%/i)).toBeInTheDocument();
  });

  it('should display total a pagar section', () => {
    renderCotizador([], { totalKg: 0, subtotal: 0, iva: 0, total: 28370 });
    expect(screen.getByText(/total a pagar/i)).toBeInTheDocument();
    expect(screen.getByText('$28.370')).toBeInTheDocument();
  });

  it('should render QuoteShareButton', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /copiar cotización/i })).toBeInTheDocument();
  });

  it('should render Guardar cotización button', () => {
    renderCotizador();
    expect(screen.getByRole('button', { name: /guardar cotización/i })).toBeInTheDocument();
  });

  it('should render the PDF trigger disabled when there are no items', async () => {
    renderCotizador();
    const pdfButton = await screen.findByRole('button', { name: /exportar pdf/i });
    expect(pdfButton).toBeDisabled();
  });

  it('should enable the PDF trigger once there are items', async () => {
    const items: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 1, precioKg: 100 },
    ];
    renderCotizador(items, { totalKg: 11.34, subtotal: 1134, iva: 215, total: 1349 });
    const pdfButton = await screen.findByRole('button', { name: /exportar pdf/i });
    expect(pdfButton).not.toBeDisabled();
  });

  it('exposes an accessible product-selector dialog and restores focus on Escape', async () => {
    const user = userEvent.setup();
    renderCotizador();

    const trigger = screen.getByRole('button', { name: /agregar producto/i });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Seleccionar Producto' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'quote-selector-title');

    // The dialog owns its close button, so it lives inside the focus trap.
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    expect(dialog).toContainElement(closeButton);

    // Initial focus lands on the search input; Shift+Tab walks back to the
    // close button, proving it is reachable through the dialog's tab order.
    const searchInput = await screen.findByRole('textbox', { name: 'Buscar productos' });
    await waitFor(() => expect(searchInput).toHaveFocus());
    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});