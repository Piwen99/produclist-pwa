import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SavedQuote } from '../types/quote';
import { useData } from '../data/useData';
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

function clientName(quote: SavedQuote): string {
  const name = quote.cliente?.trim();
  return name ? name : 'Sin cliente';
}

interface QuoteCardProps {
  quote: SavedQuote;
  onDelete: (id: number) => void;
  canDelete: boolean;
}

function QuoteCard({ quote, onDelete, canDelete }: QuoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailId = `quote-detail-${String(quote.id)}`;
  const cliente = clientName(quote);

  const handleDelete = () => {
    if (quote.id === undefined) return;
    if (confirm('¿Eliminar esta cotización?')) {
      onDelete(quote.id);
    }
  };

  return (
    <div
      data-testid={`quote-card-${String(quote.id)}`}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4"
    >
      {/* Summary row: client title, date, item count, total + delete */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? detailId : undefined}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left touch-manipulation"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
              {cliente}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(quote.fecha)}
            </span>
            <span className="block text-xs text-gray-600 dark:text-gray-300 mt-1">
              {quote.items.length} {quote.items.length === 1 ? 'ítem' : 'ítems'} · {formatCurrency(quote.total)}
            </span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="shrink-0 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors touch-manipulation"
            aria-label="Eliminar cotización"
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Expandable detail: item breakdown + totals */}
      {isExpanded && (
        <div id={detailId} className="mt-4">
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
      )}
    </div>
  );
}

export function QuoteHistory() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { repos, userId } = useData();
  const { toast } = useToast();
  // toast.error is memoized in ToastProvider; the toast container object is not.
  const showError = toast.error;

  const loadQuotes = useCallback(() => {
    repos.quotes
      .list()
      .then((data) => {
        setQuotes(data);
      })
      .catch((error: unknown) => {
        console.error('Error loading quotes:', error);
        showError('Error al cargar las cotizaciones');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [repos, showError]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Keyboard shortcut: Ctrl+/ or Cmd+/ to focus the client search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await repos.quotes.remove(id);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      toast.success('Cotización eliminada');
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Error al eliminar la cotización');
    }
  };

  const filteredQuotes = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return quotes;
    const lower = term.toLowerCase();
    return quotes.filter((quote) => clientName(quote).toLowerCase().includes(lower));
  }, [quotes, searchTerm]);

  const totalCount = quotes.length;
  const filteredCount = filteredQuotes.length;
  const isSearching = searchTerm.trim().length > 0;

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

      {/* Client search */}
      <div className="relative mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por cliente…  Ctrl+/"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
          aria-label="Buscar cotizaciones por cliente"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation"
            aria-label="Limpiar búsqueda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Result counter */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {isSearching
          ? <>{filteredCount} de {totalCount}</>
          : <>{totalCount} {totalCount !== 1 ? 'cotizaciones' : 'cotización'}</>}
      </div>

      {/* Quote rows */}
      {filteredQuotes.length > 0 ? (
        <div>
          {filteredQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onDelete={(id) => { void handleDelete(id); }}
              canDelete={quote.ownerId === userId}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 mx-auto text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">Sin resultados</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay cotizaciones para el cliente &quot;{searchTerm}&quot;.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors touch-manipulation"
          >
            Mostrar todas
          </button>
        </div>
      )}
    </div>
  );
}
