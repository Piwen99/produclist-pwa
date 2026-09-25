import type { ListSend } from '../types/listSend';
import type { SavedQuote } from '../db/database';

/** Where a price came from: a list sent to the client, or a quote. */
export type ClientPriceSource = 'lista' | 'cotizacion';

export interface ClientPriceEntry {
  nombre: string;
  formato: string;
  /** Net price per kg, as indicated to the client */
  precioNeto: number;
  /** When it was indicated */
  fecha: Date;
  fuente: ClientPriceSource;
}

/**
 * For one client, the LAST price indicated per product, across list sends and
 * quotes, sorted by product name.
 *
 * Both sources store a net price per kg (`precioNeto` for a list send,
 * `precioKg` for a quote item), so they are comparable. When the same product
 * appears in several documents, the most recent one wins.
 */
export function buildClientPriceHistory(
  sends: ListSend[],
  quotes: SavedQuote[]
): ClientPriceEntry[] {
  const byProduct = new Map<string, ClientPriceEntry>();

  const consider = (entry: ClientPriceEntry) => {
    const key = entry.nombre.trim().toLowerCase();
    if (key === '') return;
    const current = byProduct.get(key);
    if (!current || entry.fecha.getTime() > current.fecha.getTime()) {
      byProduct.set(key, entry);
    }
  };

  for (const send of sends) {
    for (const item of send.items) {
      consider({
        nombre: item.nombre,
        formato: item.formato,
        precioNeto: item.precioNeto,
        fecha: send.fecha,
        fuente: 'lista',
      });
    }
  }

  for (const quote of quotes) {
    for (const item of quote.items) {
      consider({
        nombre: item.nombre,
        formato: item.formato,
        precioNeto: item.precioKg,
        fecha: quote.fecha,
        fuente: 'cotizacion',
      });
    }
  }

  return [...byProduct.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
