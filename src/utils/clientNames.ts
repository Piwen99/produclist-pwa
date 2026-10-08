import type { SavedQuote } from '../types/quote';
import type { ListSend } from '../types/listSend';

/**
 * Every client name used so far, from saved quotes and list sends, de-duplicated
 * case-insensitively and sorted. Feeds the autocomplete on the client input.
 *
 * Quotes are considered first, so when the same name appears with different
 * casing the quote's spelling wins (first-seen casing is kept).
 */
export function mergeClientNames(quotes: SavedQuote[], sends: ListSend[]): string[] {
  const byKey = new Map<string, string>();
  for (const cliente of [
    ...quotes.map((quote) => quote.cliente),
    ...sends.map((send) => send.cliente),
  ]) {
    const name = cliente?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, name);
  }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
