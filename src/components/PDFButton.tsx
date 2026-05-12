import { useState, useCallback } from 'react';

interface PDFButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export function PDFButton({ disabled = false, onClick }: PDFButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      // Placeholder for PDF generation (coming in PR #3)
      console.log('[PDFButton] PDF generation placeholder - will be implemented in PR #3');
      
      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Call the provided onClick handler
      onClick?.();
      
      // Show coming soon message
      alert('Generación de PDF estará disponible en la próxima actualización (PR #3)');
    } finally {
      setIsLoading(false);
    }
  }, [disabled, isLoading, onClick]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        fixed bottom-4 right-4 sm:bottom-6 sm:right-6
        flex items-center gap-2
        px-4 sm:px-6 py-3 sm:py-4
        rounded-full shadow-lg
        font-medium text-sm sm:text-base
        transition-all duration-200
        touch-manipulation
        ${
          disabled || isLoading
            ? 'bg-gray-400 cursor-not-allowed shadow-none'
            : 'bg-red-600 hover:bg-red-700 hover:shadow-xl active:scale-95 text-white'
        }
      `}
      aria-label="Generar PDF"
    >
      {isLoading ? (
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
  );
}
