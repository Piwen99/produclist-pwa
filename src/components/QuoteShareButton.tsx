import { useState, useCallback } from 'react';
import type { QuoteItem, QuoteTotals } from '../types/quote';

interface QuoteShareButtonProps {
  items: QuoteItem[];
  totals: QuoteTotals;
}

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatQuoteText(items: QuoteItem[], totals: QuoteTotals): string {
  if (items.length === 0) return 'Sin productos';

  // Calculate column widths dynamically from actual data
  const nameCol = Math.max(
    ...items.map(i => i.nombre.length),
    'Producto'.length
  );
  const fmtCol = Math.max(
    ...items.map(i => `${i.formato} kg`.length),
    'Formato'.length
  );
  const cantCol = Math.max(
    ...items.map(i => String(i.cantidad).length),
    'Cant'.length
  );
  const kgCol = Math.max(
    ...items.map(i => {
      const kg = parseFloat(i.formato.replace(',', '.')) * i.cantidad;
      return `${kg.toFixed(2)} kg`.length;
    }),
    'Total kg'.length
  );
  const priceCol = Math.max(
    ...items.map(i => clpFormatter.format(i.precioKg).length),
    '$/kg'.length
  );
  const subCol = Math.max(
    ...items.map(i => {
      const kg = parseFloat(i.formato.replace(',', '.')) * i.cantidad;
      return clpFormatter.format(kg * i.precioKg).length;
    }),
    'Subtotal'.length
  );

  // 2-char gap between columns
  const gap = '  ';
  const separator = '─'.repeat(
    nameCol + gap.length + fmtCol + gap.length + cantCol + gap.length +
    kgCol + gap.length + priceCol + gap.length + subCol
  );

  const lines: string[] = [];

  // Header
  lines.push('📋 COTIZACIÓN');
  lines.push(separator);
  lines.push([
    'Producto'.padEnd(nameCol),
    'Formato'.padStart(fmtCol),
    'Cant'.padStart(cantCol),
    'Total kg'.padStart(kgCol),
    '$ / kg'.padStart(priceCol),
    'Subtotal'.padStart(subCol),
  ].join(gap));
  lines.push(separator);

  // Items — one row per product
  for (const item of items) {
    const itemKg = parseFloat(item.formato.replace(',', '.')) * item.cantidad;
    const subtotal = itemKg * item.precioKg;
    lines.push([
      item.nombre.padEnd(nameCol),
      `${item.formato} kg`.padStart(fmtCol),
      String(item.cantidad).padStart(cantCol),
      `${itemKg.toFixed(2)} kg`.padStart(kgCol),
      clpFormatter.format(item.precioKg).padStart(priceCol),
      clpFormatter.format(subtotal).padStart(subCol),
    ].join(gap));
  }

  // Totals — right-aligned below the table
  lines.push(separator);
  const tableWidth = separator.length;

  /*** @note The table separator character '─' (U+2500) is exactly 1 column wide in
   *  monospace fonts — same as regular ASCII characters. So `.length` calculations
   *  for alignment are accurate within the table. ***/

  const padTotal = (label: string, value: string): string =>
    `  ${label} ${value.padStart(tableWidth - 2 - label.length)}`;

  lines.push(padTotal('Subtotal Neto:', clpFormatter.format(totals.subtotal)));
  lines.push(padTotal('IVA 19%:',      clpFormatter.format(totals.iva)));
  lines.push(padTotal('TOTAL:',        clpFormatter.format(totals.total)));

  return lines.join('\n');
}

export function QuoteShareButton({ items, totals }: QuoteShareButtonProps) {
  const isEmpty = items.length === 0;
  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = formatQuoteText(items, totals);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [items, totals]);

  const handleShare = async () => {
    const text = formatQuoteText(items, totals);
    await navigator.share({
      title: 'Cotización',
      text,
    });
  };

  const handleWhatsApp = () => {
    const text = formatQuoteText(items, totals);
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        onClick={() => { void handleCopy(); }}
        disabled={isEmpty}
        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
        aria-label="Copiar cotización"
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            ¡Copiado!
          </span>
        ) : (
          'Copiar cotización'
        )}
      </button>
      <button
        onClick={handleWhatsApp}
        disabled={isEmpty}
        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
        aria-label="Enviar por WhatsApp"
      >
        WhatsApp
      </button>
      {hasShare && (
        <button
          onClick={() => { void handleShare(); }}
          disabled={isEmpty}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
          aria-label="Compartir cotización"
        >
          Compartir
        </button>
      )}
    </div>
  );
}