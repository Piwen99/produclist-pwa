import { useEffect, useState } from 'react';
import { db, getClientNames } from '../db/database';
import { buildClientPriceHistory, type ClientPriceEntry } from '../utils/clientTracking';
import { formatCurrency } from '../utils/price';

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

/**
 * Per-client price tracking: for the selected client, the last price indicated
 * for each product, and when — built from saved list sends and quotes.
 */
export function ClientPrices() {
  const [clients, setClients] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<ClientPriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getClientNames()
      .then((names) => {
        setClients(names);
        setSelected((current) => current || names[0] || '');
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!selected) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Match client names case-insensitively: the stored casing is free text.
      const key = selected.trim().toLowerCase();
      const [sends, quotes] = await Promise.all([
        db.listSends.toArray(),
        db.quotes.toArray(),
      ]);

      if (!cancelled) {
        setEntries(
          buildClientPriceHistory(
            sends.filter((send) => send.cliente.trim().toLowerCase() === key),
            quotes.filter((quote) => quote.cliente?.trim().toLowerCase() === key)
          )
        );
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
      ) : entries.length === 0 ? (
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
    </div>
  );
}
