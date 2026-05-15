import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteShareButton } from '../QuoteShareButton';
import type { QuoteItem, QuoteTotals } from '../../types/quote';

const mockItems: QuoteItem[] = [
  {
    id: 'item-1',
    productId: 1,
    nombre: 'Almendra Laminada',
    formato: '11,34',
    cantidad: 10,
    precioKg: 100,
  },
];

const mockTotals: QuoteTotals = {
  totalKg: 113.4,
  subtotal: 11340,
  iva: 2155,
  total: 13495,
};

describe('QuoteShareButton', () => {
  let clipboardMock: { writeText: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('navigator', {
      clipboard: clipboardMock,
      share: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render "Copiar cotización" button', () => {
    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    expect(screen.getByRole('button', { name: /copiar cotización/i })).toBeInTheDocument();
  });

  it('should copy formatted quote text to clipboard', async () => {
    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    const button = screen.getByRole('button', { name: /copiar cotización/i });
    fireEvent.click(button);

    expect(clipboardMock.writeText).toHaveBeenCalledTimes(1);
    const copiedText = clipboardMock.writeText.mock.calls[0][0];
    // Verify quote contains key elements
    expect(copiedText).toContain('COTIZACIÓN');
    expect(copiedText).toContain('Almendra Laminada');
    expect(copiedText).toContain('11,34');
    expect(copiedText).toContain('10');
    expect(copiedText).toContain('$11.340'); // Subtotal formatted
  });

  it('should format prices with Intl.NumberFormat es-CL', async () => {
    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    const button = screen.getByRole('button', { name: /copiar cotización/i });
    fireEvent.click(button);

    const copiedText = clipboardMock.writeText.mock.calls[0][0];
    expect(copiedText).toContain('$13.495'); // Total formatted with es-CL thousands separator
  });

  it('should disable button when items is empty', () => {
    render(<QuoteShareButton items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} />);
    const button = screen.getByRole('button', { name: /copiar cotización/i });
    expect(button).toBeDisabled();
  });

  it('should show share button when navigator.share is available', () => {
    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
  });

  it('should call navigator.share when share button is clicked', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: clipboardMock,
      share: shareMock,
    });

    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    const shareButton = screen.getByRole('button', { name: /compartir/i });
    fireEvent.click(shareButton);

    expect(shareMock).toHaveBeenCalledTimes(1);
  });

  it('should hide share button when navigator.share is not available', () => {
    vi.stubGlobal('navigator', {
      clipboard: clipboardMock,
      // share is undefined
    });

    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument();
  });

  it('should render WhatsApp button', () => {
    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('should open wa.me link when WhatsApp button is clicked', () => {
    const openMock = vi.fn();
    vi.stubGlobal('window', { open: openMock });

    render(<QuoteShareButton items={mockItems} totals={mockTotals} />);
    const whatsappButton = screen.getByRole('button', { name: /whatsapp/i });
    fireEvent.click(whatsappButton);

    expect(openMock).toHaveBeenCalledTimes(1);
    const url = openMock.mock.calls[0][0];
    expect(url).toContain('wa.me');
    expect(url).toContain('text=');
    expect(url).toContain(encodeURIComponent('COTIZACIÓN'));
  });

  it('should disable WhatsApp button when items is empty', () => {
    render(<QuoteShareButton items={[]} totals={{ totalKg: 0, subtotal: 0, iva: 0, total: 0 }} />);
    const button = screen.getByRole('button', { name: /whatsapp/i });
    expect(button).toBeDisabled();
  });

  it('should handle multiple items in quote text', () => {
    const multiItems: QuoteItem[] = [
      { id: 'item-1', productId: 1, nombre: 'Almendra', formato: '11,34', cantidad: 10, precioKg: 100 },
      { id: 'item-2', productId: 2, nombre: 'Chía', formato: '25', cantidad: 5, precioKg: 200 },
    ];
    const multiTotals: QuoteTotals = { totalKg: 238.4, subtotal: 47680, iva: 9059, total: 56739 };

    render(<QuoteShareButton items={multiItems} totals={multiTotals} />);
    const button = screen.getByRole('button', { name: /copiar cotización/i });
    fireEvent.click(button);

    const copiedText = clipboardMock.writeText.mock.calls[0][0];
    expect(copiedText).toContain('Almendra');
    expect(copiedText).toContain('Chía');
  });
});