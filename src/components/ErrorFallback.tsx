interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <svg
          className="h-8 w-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Algo salió mal
      </h1>

      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Ocurrió un error inesperado. No te preocupes, tus datos están seguros en
        el dispositivo.
      </p>

      {error.message && (
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 font-mono max-w-md truncate">
          {error.message}
        </p>
      )}

      <button
        onClick={resetErrorBoundary}
        className="mt-6 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors touch-manipulation"
      >
        Reintentar
      </button>
    </div>
  );
}
