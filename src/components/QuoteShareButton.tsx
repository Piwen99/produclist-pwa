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
  const lines: string[] = ['COTIZACIÓN', '━━━━━━━━━━━━━━━━━━'];

  for (const item of items) {
    const itemKg = parseFloat(item.formato.replace(',', '.')) * item.cantidad;
    const subtotal = itemKg * item.precioKg;
    lines.push(item.nombre);
    lines.push(`   Formato: ${item.formato} kg | Cant: ${item.cantidad} unid | Total: ${itemKg.toFixed(1)} kg`);
    lines.push(`   $/kg: ${clpFormatter.format(item.precioKg)} | Subtotal: ${clpFormatter.format(subtotal)}`);
    lines.push('━━━━━━━━━━━━━━━━━━');
  }

  lines.push(`Subtotal Neto: ${clpFormatter.format(totals.subtotal)}`);
  lines.push(`IVA 19%:       ${clpFormatter.format(totals.iva)}`);
  lines.push(`TOTAL:         ${clpFormatter.format(totals.total)}`);

  return lines.join('\n');
}

export function QuoteShareButton({ items, totals }: QuoteShareButtonProps) {
  const isEmpty = items.length === 0;
  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    const text = formatQuoteText(items, totals);
    await navigator.clipboard.writeText(text);
  };

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
        onClick={handleCopy}
        disabled={isEmpty}
        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
        aria-label="Copiar cotización"
      >
        Copiar cotización
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
          onClick={handleShare}
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