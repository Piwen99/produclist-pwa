import { useState, useEffect, useRef } from 'react';
import { getQuotePDFFileName } from '../pdf/quotePdfFilename';
import type { QuoteItem, QuoteTotals } from '../types/quote';

interface QuotePDFModule {
  PDFDownloadLink: typeof import('@react-pdf/renderer').PDFDownloadLink;
  QuotePDFDocument: typeof import('../pdf/QuotePDFDocument').QuotePDFDocument;
}

interface QuotePDFButtonProps {
  items: QuoteItem[];
  totals: QuoteTotals;
  cliente?: string;
  disabled?: boolean;
}

const SPINNER_PATH =
  'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z';
const DOCUMENT_PATH =
  'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
const ERROR_PATH = 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d={SPINNER_PATH} />
    </svg>
  );
}

const baseButtonClass =
  'flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed';

export function QuotePDFButton({ items, totals, cliente, disabled = false }: QuotePDFButtonProps) {
  const [pdfState, setPdfState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pdfModule, setPdfModule] = useState<QuotePDFModule | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | undefined>(undefined);

  const isEmpty = items.length === 0;
  const isDisabled = disabled || isEmpty;

  // Preload the PDF module on mount so the button is ready before first click.
  useEffect(() => {
    let cancelled = false;

    const loadModule = async () => {
      try {
        const mod = await import('../pdf/QuotePDFDocument');
        if (!cancelled) {
          setPdfModule({
            PDFDownloadLink: mod.PDFDownloadLink,
            QuotePDFDocument: mod.QuotePDFDocument,
          });
          setPdfState('ready');
        }
      } catch (err) {
        console.error('Failed to load quote PDF module:', err);
        if (!cancelled) {
          setPdfState('error');
          // Retry after delay, mirroring PDFButton's recovery.
          retryTimeoutRef.current = window.setTimeout(() => {
            if (!cancelled) {
              setRetryCount((r) => r + 1);
              setPdfState('loading');
            }
          }, 2000);
        }
      }
    };

    void loadModule();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [retryCount]);

  // Error state — the module could not be imported; the retry timer is pending.
  if (pdfState === 'error' && !pdfModule) {
    return (
      <button
        disabled
        className={`${baseButtonClass} bg-gray-400 cursor-not-allowed shadow-none`}
        aria-label="Error al cargar PDF"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ERROR_PATH} />
        </svg>
        <span>Error PDF</span>
      </button>
    );
  }

  // Loading state — module still being imported.
  if (pdfState === 'loading' || !pdfModule) {
    return (
      <button
        disabled
        className={`${baseButtonClass} bg-red-600 cursor-wait`}
        aria-label="Generando PDF"
      >
        <Spinner />
        <span>Generando…</span>
      </button>
    );
  }

  // Ready state — mirror PDFButton's render-prop wiring.
  return (
    <pdfModule.PDFDownloadLink
      document={
        <pdfModule.QuotePDFDocument items={items} totals={totals} cliente={cliente} />
      }
      fileName={getQuotePDFFileName(cliente)}
    >
      {({ loading, error }) => (
        <button
          disabled={isDisabled || loading}
          className={`${baseButtonClass} ${
            isDisabled || loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
          }`}
          aria-label="Exportar PDF"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Generando…</span>
            </>
          ) : error ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ERROR_PATH} />
              </svg>
              <span>Error PDF</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={DOCUMENT_PATH} />
              </svg>
              <span>PDF</span>
            </>
          )}
        </button>
      )}
    </pdfModule.PDFDownloadLink>
  );
}