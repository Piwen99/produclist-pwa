import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListSend } from '../types/listSend';
import { useData } from '../data/useData';
import { useToast } from '../hooks/useToast';

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function itemCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'ítem' : 'ítems'}`;
}

export function ListSends() {
  const [listSends, setListSends] = useState<ListSend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { repos } = useData();
  const { toast } = useToast();
  // toast.error is memoized in ToastProvider; the toast container object is not.
  const showError = toast.error;

  const loadListSends = useCallback(() => {
    repos.listSends
      .list()
      .then((data) => {
        setListSends(data);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        console.error('Error loading sent lists:', error);
        setLoadError(true);
        showError('Error al cargar las listas enviadas');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [repos, showError]);

  useEffect(() => {
    loadListSends();
  }, [loadListSends]);

  // Keyboard shortcut: Ctrl+/ or Cmd+/ to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isSearching = searchTerm.trim().length > 0;
  const totalCount = listSends.length;

  const filteredListSends = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return listSends;
    return listSends.filter((send) => send.cliente.toLowerCase().includes(term));
  }, [listSends, searchTerm]);

  const filteredCount = filteredListSends.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Listas Enviadas</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-red-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-gray-900 dark:text-white font-medium mb-1">
            No se pudieron cargar las listas enviadas
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Revisá tu conexión e intentá de nuevo.
          </p>
          <button
            onClick={loadListSends}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors touch-manipulation"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Listas Enviadas</h2>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-900 dark:text-white font-medium mb-1">No hay listas enviadas</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Guardá una lista enviada desde el menú para verla acá.
          </p>
        </div>
      ) : (
        <>
          {/* Search bar */}
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
              aria-label="Buscar listas enviadas por cliente"
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
          <div className="flex justify-end mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isSearching
                ? <>{filteredCount} de {totalCount}</>
                : <>{totalCount} {totalCount === 1 ? 'lista' : 'listas'}</>}
            </div>
          </div>

          {filteredCount === 0 ? (
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
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Sin resultados</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ninguna lista coincide con <strong>&quot;{searchTerm}&quot;</strong>
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors touch-manipulation"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredListSends.map((send) => (
                <li
                  key={send.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {send.cliente}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(send.fecha)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {itemCountLabel(send.items.length)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
