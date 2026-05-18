import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllQuotes, deleteQuote, type SavedQuote } from '../db/database';
import { useToast } from '../hooks/useToast';
import { formatCurrency, parseChileanNumber } from '../utils/price';

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface QuoteCardProps {
  quote: SavedQuote;
  onDelete: (id: number) => void;
}

function QuoteCard({ quote, onDelete }: QuoteCardProps) {
  const handleDelete = () => {
    if (confirm('¿Eliminar esta cotización?')) {
      onDelete(quote.id!);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      {/* Header with date and delete button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {formatDate(quote.fecha)}
        </span>
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          aria-label="Eliminar cotización"
        >
          Eliminar
        </button>
      </div>

      {/* Items summary */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {quote.items.length} {quote.items.length === 1 ? 'ítem' : 'ítems'}
      </div>

      {/* Item breakdown */}
      <div className="space-y-1 mb-4">
        {quote.items.map((item) => {
          const itemKg = parseChileanNumber(item.formato) * item.cantidad;
          const subtotal = itemKg * item.precioKg;
          return (
            <div key={item.id} className="text-sm text-gray-700 dark:text-gray-300 flex justify-between">
              <span>{item.nombre}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {item.cantidad} × {item.formato.replace('.', ',')} kg = {clpFormatter.format(subtotal)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total Neto:</span>
          <span className="text-gray-900 dark:text-white">{formatCurrency(quote.totalNeto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">IVA 19%:</span>
          <span className="text-gray-900 dark:text-white">{formatCurrency(quote.iva)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-gray-900 dark:text-white">Total:</span>
          <span className="text-orange-600 dark:text-orange-400">{formatCurrency(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

export function QuoteHistory() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const data = await getAllQuotes();
      setQuotes(data);
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast.error('Error al cargar las cotizaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteQuote(id);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      toast.success('Cotización eliminada');
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Error al eliminar la cotización');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          No hay cotizaciones guardadas
        </p>
        <Link
          to="/cotizador"
          className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium inline-block"
        >
          Ir al cotizador
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Historial de Cotizaciones</h2>
      <div>
        {quotes.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}