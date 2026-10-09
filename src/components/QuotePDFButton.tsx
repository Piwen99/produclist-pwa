import { getQuotePDFFileName } from '../pdf/quotePdfFilename';
import { usePdfModule } from '../pdf/usePdfModule';
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
const REFRESH_PATH =
  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

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

const loadQuotePdfModule = async (): Promise<QuotePDFModule> => {
  const mod = await import('../pdf/QuotePDFDocument');
  return {
    PDFDownloadLink: mod.PDFDownloadLink,
    QuotePDFDocument: mod.QuotePDFDocument,
  };
};

export function QuotePDFButton({ items, totals, cliente, disabled = false }: QuotePDFButtonProps) {
  const { status, module: pdfModule, reload } = usePdfModule(loadQuotePdfModule);

  const isEmpty = items.length === 0;
  const isDisabled = disabled || isEmpty;

  // Error state — the module could not be imported.
  if (status === 'error') {
    return (
      <button
        onClick={reload}
        className={`${baseButtonClass} bg-amber-500 hover:bg-amber-600`}
        aria-label="Actualizar PDF"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={REFRESH_PATH} />
        </svg>
        <span>Actualizar</span>
      </button>
    );
  }

  // Loading state — module still being imported.
  if (status === 'loading' || !pdfModule) {
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
