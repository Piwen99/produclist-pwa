import { useState, useEffect, useRef } from 'react';
import { getPDFFileName } from '../pdf/pdfFilename';

interface PDFModule {
  PDFDownloadLink: typeof import('@react-pdf/renderer').PDFDownloadLink;
  ProductPDFDocument: typeof import('../pdf/ProductPDFDocument').ProductPDFDocument;
}

interface PDFButtonProps {
  disabled?: boolean;
}

export function PDFButton({ disabled = false }: PDFButtonProps) {
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [pdfState, setPdfState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pdfModule, setPdfModule] = useState<PDFModule | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | undefined>(undefined);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Preload PDF module on mount
  useEffect(() => {
    let cancelled = false;

    const loadModule = async () => {
      try {
        const mod = await import('../pdf/ProductPDFDocument');
        if (!cancelled) {
          setPdfModule({
            PDFDownloadLink: mod.PDFDownloadLink,
            ProductPDFDocument: mod.ProductPDFDocument,
          });
          setPdfState('ready');
        }
      } catch (err) {
        console.error('Failed to load PDF module:', err);
        if (!cancelled) {
          setPdfState('error');
          // Retry after delay
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
  }, [retryCount]); // Retry when retryCount changes

  const handleClick = () => {
    if (!isOnline) {
      setShowOfflineWarning(true);
      setTimeout(() => setShowOfflineWarning(false), 3000);
    }
  };

  // Error state
  if (pdfState === 'error' && !pdfModule) {
    return (
      <button
        disabled
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6
          flex items-center gap-2
          px-4 sm:px-6 py-3 sm:py-4
          rounded-full shadow-lg
          font-medium text-sm sm:text-base
          transition-all duration-200
          touch-manipulation
          bg-gray-400 cursor-not-allowed shadow-none"
        aria-label="Error al cargar PDF"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="hidden sm:inline">Error al cargar PDF</span>
        <span className="sm:hidden">Error</span>
      </button>
    );
  }

  // Loading state
  if (pdfState === 'loading' || !pdfModule) {
    return (
      <button
        disabled
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6
          flex items-center gap-2
          px-4 sm:px-6 py-3 sm:py-4
          rounded-full shadow-lg
          font-medium text-sm sm:text-base
          transition-all duration-200
          touch-manipulation
          bg-red-600 text-white cursor-wait"
        aria-label="Cargando módulo PDF"
      >
        <svg
          className="animate-spin h-4 w-4 sm:h-5 sm:w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Cargando PDF...</span>
      </button>
    );
  }

  // Ready state
  return (
    <>
      <pdfModule.PDFDownloadLink
        document={<pdfModule.ProductPDFDocument />}
        fileName={getPDFFileName()}
      >
        {({ loading, error }) => (
          <button
            onClick={handleClick}
            disabled={disabled || loading || !isOnline}
            className={`
              fixed bottom-4 right-4 sm:bottom-6 sm:right-6
              flex items-center gap-2
              px-4 sm:px-6 py-3 sm:py-4
              rounded-full shadow-lg
              font-medium text-sm sm:text-base
              transition-all duration-200
              touch-manipulation
              ${
                disabled || loading || !isOnline
                  ? 'bg-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-red-600 hover:bg-red-700 hover:shadow-xl active:scale-95 text-white'
              }
            `}
            aria-label="Generar PDF"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 sm:h-5 sm:w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Generando...</span>
              </>
            ) : error ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Error PDF</span>
                <span className="sm:hidden">Error</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="hidden sm:inline">Generar PDF</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </button>
        )}
      </pdfModule.PDFDownloadLink>

      {/* Offline warning toast */}
      {showOfflineWarning && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Conéctate a internet para generar el PDF</span>
          </div>
        </div>
      )}
    </>
  );
}