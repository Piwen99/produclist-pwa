import { useEffect, useState } from 'react';
import { useData } from '../data/useData';
import { buildClientPriceHistory, type ClientPriceEntry } from '../utils/clientTracking';
import { formatCurrency } from '../utils/price';
import type { ListSend } from '../types/listSend';
import type { SavedQuote } from '../types/quote';

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

/** A saved document shown in the per-client history, merged across both kinds. */
interface ClientDocument {
  key: string;
  kind: 'lista' | 'cotizacion';
  fecha: Date;
  itemCount: number;
  /** Only quotes store a total; sent lists carry per-kg prices, no quantity. */
  total?: number;
}

/**
 * Stable list key for a document: prefer the persisted id and fall back to the
 * array index when it is missing. The id is widened to `number | undefined |
 * null` so a `null` id (which the domain type does not model, but a degraded
 * row can still carry) takes the same index-based fallback as `undefined`;
 * otherwise every null-id row would share the key `lista-null` / `cotizacion-null`
 * and collide.
 */
function documentKey(
  kind: 'lista' | 'cotizacion',
  id: number | undefined | null,
  index: number,
): string {
  return id === undefined || id === null
    ? `${kind}-x${String(index)}`
    : `${kind}-${String(id)}`;
}

/**
 * Merge a client's sent lists and quotes into a single newest-first document
 * list. Sent lists have no stored total, so only quotes carry one.
 */
function buildClientDocuments(sends: ListSend[], quotes: SavedQuote[]): ClientDocument[] {
  const documents: ClientDocument[] = [
    ...sends.map((send, index) => ({
      key: documentKey('lista', send.id, index),
      kind: 'lista' as const,
      fecha: send.fecha,
      itemCount: send.items.length,
    })),
    ...quotes.map((quote, index) => ({
      key: documentKey('cotizacion', quote.id, index),
      kind: 'cotizacion' as const,
      fecha: quote.fecha,
      itemCount: quote.items.length,
      total: quote.total,
    })),
  ];
  return documents.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}

/**
 * Per-client price tracking: for the selected client, the last price indicated
 * for each product, and when — built from saved list sends and quotes.
 */
export function ClientPrices() {
  const [clients, setClients] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<ClientPriceEntry[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { repos } = useData();

  useEffect(() => {
    void repos.clients
      .listNames()
      .then((names) => {
        setClients(names);
        setSelected((current) => current || names[0] || '');
      })
      .catch(console.error);
  }, [repos]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!selected) {
        setEntries([]);
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Match client names case-insensitively: the stored casing is free text.
      const key = selected.trim().toLowerCase();
      // RLS-visible union: an admin sees every owner's rows, a vendor own only.
      const [sends, quotes] = await Promise.all([
        repos.listSends.list(),
        repos.quotes.list(),
      ]);

      if (!cancelled) {
        const clientSends = sends.filter((send) => send.cliente.trim().toLowerCase() === key);
        const clientQuotes = quotes.filter(
          (quote) => quote.cliente?.trim().toLowerCase() === key
        );
        setEntries(buildClientPriceHistory(clientSends, clientQuotes));
        setDocuments(buildClientDocuments(clientSends, clientQuotes));
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [repos, selected]);

  if (clients.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Todavía no hay clientes. Guardá una lista enviada o una cotización con nombre de cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Clientes</h2>
        <label
          htmlFor="client-prices-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Cliente
        </label>
        <select
          id="client-prices-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-6 overflow-y-auto">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Historial de documentos
            </h3>
            {documents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Sin documentos para este cliente.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <li
                    key={doc.key}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {doc.kind === 'lista' ? 'Lista enviada' : 'Cotización'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(doc.fecha)} · {doc.itemCount}{' '}
                        {doc.itemCount === 1 ? 'ítem' : 'ítems'}
                      </p>
                    </div>
                    {doc.total !== undefined && (
                      <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(doc.total)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Últimos precios por producto
            </h3>
            {entries.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No hay precios registrados para este cliente.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {entries.map((entry) => (
                  <li key={entry.nombre} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {entry.nombre}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.formato} kg ·{' '}
                        {entry.fuente === 'lista' ? 'Lista enviada' : 'Cotización'} ·{' '}
                        {formatDate(entry.fecha)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(entry.precioNeto)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
