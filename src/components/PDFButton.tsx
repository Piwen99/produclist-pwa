import { getPDFFileName } from '../pdf/pdfFilename';
import { useData } from '../data/useData';
import { usePdfModule } from '../pdf/usePdfModule';

interface PDFModule {
  PDFDownloadLink: typeof import('@react-pdf/renderer').PDFDownloadLink;
  ProductPDFDocument: typeof import('../pdf/ProductPDFDocument').ProductPDFDocument;
}

interface PDFButtonProps {
  disabled?: boolean;
}

const loadPdfModule = async (): Promise<PDFModule> => {
  const mod = await import('../pdf/ProductPDFDocument');
  return {
    PDFDownloadLink: mod.PDFDownloadLink,
    ProductPDFDocument: mod.ProductPDFDocument,
  };
};

export function PDFButton({ disabled = false }: PDFButtonProps) {
  const { products } = useData();
  const { status, module: pdfModule, reload } = usePdfModule(loadPdfModule);

  // Error state
  if (status === 'error') {
    return (
      <button
        onClick={reload}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6
          flex items-center gap-2
          px-4 sm:px-6 py-3 sm:py-4
          rounded-full shadow-lg
          font-medium text-sm sm:text-base
          transition-all duration-200
          touch-manipulation
          bg-amber-500 hover:bg-amber-600 text-white active:scale-95"
        aria-label="Actualizar PDF"
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
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="hidden sm:inline">Actualizar PDF</span>
        <span className="sm:hidden">Actualizar</span>
      </button>
    );
  }

  // Loading state
  if (status === 'loading' || !pdfModule) {
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
        document={<pdfModule.ProductPDFDocument products={products ?? []} />}
        fileName={getPDFFileName()}
      >
        {({ loading, error }) => (
          <button
            disabled={disabled || loading}
            className={`
              fixed bottom-4 right-4 sm:bottom-6 sm:right-6
              flex items-center gap-2
              px-4 sm:px-6 py-3 sm:py-4
              rounded-full shadow-lg
              font-medium text-sm sm:text-base
              transition-all duration-200
              touch-manipulation
              ${
                disabled || loading
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
    </>
  );
}
