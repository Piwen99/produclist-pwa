import type { Repositories } from '../data/ports';
import type { Product, ProductInput, Category } from '../types/product';
import type { QuoteItem, SavedQuote } from '../types/quote';
import type { ListSend } from '../types/listSend';
import { isValidChileanFormat } from './price';

const CATEGORY_VALUES: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

/** Version of the backup file format written by `exportBackup`. */
export const BACKUP_VERSION = 3;

/**
 * Backup file format v3: the whole local database in one file. Adds `listSends`
 * to v2 so the "last price sent to each client" history survives a migration.
 *
 * Older inputs are still accepted on import: v2 (an object with `products` and
 * `quotes`) and the legacy v1 (a bare array of products). Both yield no list
 * sends.
 */
export interface BackupFile {
  version: number;
  exportedAt: string;
  products: Product[];
  quotes: SavedQuote[];
  listSends: ListSend[];
}

/**
 * Download a blob as a file in the browser.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function backupFilename(now: Date = new Date()): string {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `produclist-backup-${y}-${m}-${d}.json`;
}

/**
 * Format a date as `yyyy-mm-dd` using the LOCAL calendar day (matching
 * `backupFilename`). Import error labels must read the day the user sees on
 * their device; `toISOString()` is UTC and can be off by one at day boundaries.
 */
function isoDate(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Trim a client name, tolerating a malformed non-string value. */
function normalizedCliente(cliente: unknown): string {
  return typeof cliente === 'string' ? cliente.trim() : '';
}

/**
 * Human label for a quote that failed to import. Throw-safe by construction: an
 * unusable date degrades to a generic label so the per-item catch can never
 * throw while building the label and abandon the remaining records.
 */
function quoteLabel(quote: { fecha: unknown }): string {
  const fecha = quote.fecha;
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return '(cotización)';
  }
  return `(cotización del ${isoDate(fecha)})`;
}

/** Human label for a list send that failed to import. Throw-safe on client name. */
function listSendLabel(send: { cliente: unknown }): string {
  const cliente = normalizedCliente(send.cliente);
  return cliente ? `(lista enviada de ${cliente})` : '(lista enviada)';
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  success: number;
  updated: number;
  quotesAdded: number;
  listSendsAdded: number;
  errors: ImportError[];
}

export interface ImportError {
  nombre: string;
  error: string;
}

/**
 * A validated import matched against the current database, ready to apply.
 * Building a preview never writes anything — see `applyImport`.
 */
export interface ImportPreview {
  toAdd: ProductInput[];
  toUpdate: { id: number; input: ProductInput }[];
  quotesToAdd: SavedQuote[];
  listSendsToAdd: ListSend[];
  errors: ImportError[];
}

/**
 * Validate one raw entry of an import file.
 * Returns a `ProductInput` when valid, or an `ImportError` describing the problem.
 */
function parseImportItem(raw: unknown): ProductInput | ImportError {
  if (typeof raw !== 'object' || raw === null) {
    return { nombre: '(entrada inválida)', error: 'Cada entrada debe ser un objeto.' };
  }

  const item = raw as Record<string, unknown>;

  const rawNombre = item.nombre;
  if (typeof rawNombre !== 'string' || rawNombre.trim() === '') {
    return { nombre: '(sin nombre)', error: 'Campo "nombre" obligatorio.' };
  }
  const nombre = rawNombre.trim();

  const rawCategoria = item.categoria;
  if (
    typeof rawCategoria !== 'string' ||
    !CATEGORY_VALUES.includes(rawCategoria as Category)
  ) {
    return {
      nombre,
      error: `Categoría inválida "${typeof rawCategoria === 'string' ? rawCategoria : ''}". Debe ser una de: ${CATEGORY_VALUES.join(', ')}.`,
    };
  }

  const formato = typeof item.formato === 'string' ? item.formato : '';
  if (formato && !isValidChileanFormat(formato)) {
    return {
      nombre,
      error: `Formato inválido "${formato}". Use formato chileno (ej: 11,34).`,
    };
  }

  const rawPrecioNeto = item.precioNeto;
  const precioNeto =
    typeof rawPrecioNeto === 'number' ? rawPrecioNeto : Number(rawPrecioNeto);
  if (!Number.isFinite(precioNeto) || precioNeto < 0) {
    return {
      nombre,
      error: 'El precio neto debe ser un número mayor o igual a 0.',
    };
  }

  return {
    nombre,
    categoria: rawCategoria as Category,
    formato,
    precioNeto,
    disponible: item.disponible !== false,
  };
}

/**
 * Content signature of a saved quote.
 *
 * Quotes merge by content, not by id: two devices can hold the same quote with
 * different auto-increment ids, so ids cannot identify "the same quote".
 */
function quoteSignature(quote: SavedQuote): string {
  return JSON.stringify({
    fecha: new Date(quote.fecha).toISOString(),
    items: quote.items.map((i) => ({
      nombre: i.nombre,
      formato: i.formato,
      cantidad: i.cantidad,
      precioKg: i.precioKg,
    })),
    total: quote.total,
  });
}

/**
 * Content signature of a sent price list. Mirrors `quoteSignature`: ids cannot
 * identify "the same send" across devices, so sends merge by content. The client
 * name is normalized (trimmed + lowercased) so whitespace/case differences do
 * not create phantom duplicates.
 */
export function listSendSignature(send: ListSend): string {
  return JSON.stringify({
    fecha: new Date(send.fecha).toISOString(),
    cliente: normalizedCliente(send.cliente).toLowerCase(),
    items: send.items.map((i) => ({
      nombre: i.nombre,
      formato: i.formato,
      precioNeto: i.precioNeto,
      precioBruto: i.precioBruto,
    })),
  });
}

/** Validate one raw quote entry. Returns null when the shape is unusable. */
function parseQuoteItem(raw: unknown): SavedQuote | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const quote = raw as Record<string, unknown>;
  if (!Array.isArray(quote.items)) return null;

  const fecha = new Date(String(quote.fecha));
  if (Number.isNaN(fecha.getTime())) return null;

  return {
    fecha,
    items: quote.items as QuoteItem[],
    totalNeto: Number(quote.totalNeto) || 0,
    iva: Number(quote.iva) || 0,
    total: Number(quote.total) || 0,
  };
}

/** Validate one raw list-send entry. Returns null when the shape is unusable. */
function parseListSendItem(raw: unknown): ListSend | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const send = raw as Record<string, unknown>;
  if (!Array.isArray(send.items)) return null;

  const fecha = new Date(String(send.fecha));
  if (Number.isNaN(fecha.getTime())) return null;

  return {
    fecha,
    cliente: typeof send.cliente === 'string' ? send.cliente : '',
    items: send.items as ListSend['items'],
  };
}

/**
 * Keep the entries of `incoming` whose content signature is not already present
 * in `existing`. Duplicate signatures inside `incoming` are collapsed too. Order
 * is preserved.
 */
function unseenBySignature<T>(
  existing: Iterable<string>,
  incoming: T[],
  signature: (value: T) => string
): T[] {
  const seen = new Set(existing);
  const unseen: T[] = [];
  for (const value of incoming) {
    const key = signature(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unseen.push(value);
  }
  return unseen;
}

/**
 * Parse and validate the text of a JSON import file.
 *
 * Accepts every backup format: v3 (an object with `products`, `quotes` and
 * `listSends`), v2 (an object with `products` and `quotes`) and the legacy v1
 * (a bare array of products). v1/v2 files yield an empty `listSends` array.
 * Pure: no database access, nothing is written. Throws only when the file is
 * not valid JSON or has no products.
 */
export function parseProductImport(text: string): {
  valid: ProductInput[];
  quotes: SavedQuote[];
  listSends: ListSend[];
  errors: ImportError[];
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const rawProducts: unknown = Array.isArray(data)
    ? data
    : isObject
      ? (data as Record<string, unknown>).products
      : undefined;

  if (!Array.isArray(rawProducts)) {
    throw new Error('El archivo no contiene un arreglo de productos.');
  }

  const valid: ProductInput[] = [];
  const errors: ImportError[] = [];

  for (const entry of rawProducts) {
    const parsed = parseImportItem(entry);
    if ('error' in parsed) {
      errors.push(parsed);
    } else {
      valid.push(parsed);
    }
  }

  const rawQuotes = isObject ? (data as Record<string, unknown>).quotes : undefined;
  const quotes: SavedQuote[] = Array.isArray(rawQuotes)
    ? rawQuotes
        .map(parseQuoteItem)
        .filter((quote): quote is SavedQuote => quote !== null)
    : [];

  const rawListSends = isObject ? (data as Record<string, unknown>).listSends : undefined;
  const listSends: ListSend[] = Array.isArray(rawListSends)
    ? rawListSends
        .map(parseListSendItem)
        .filter((send): send is ListSend => send !== null)
    : [];

  return { valid, quotes, listSends, errors };
}

/**
 * Owner-scoped backup and import operations over the repository ports.
 *
 * Every read is scoped to one user (`listOwn(userId)`), so exporting an admin's
 * backup contains only the admin's own partition, never the rows RLS also makes
 * visible. Imports match and merge against that same partition.
 */
export interface BackupService {
  /** Read one user's partition (products, quotes, list sends) and download it. */
  exportBackup(): Promise<void>;
  previewImport(text: string): Promise<ImportPreview>;
  applyImport(preview: ImportPreview): Promise<ImportResult>;
}

/**
 * Match a validated import against the user's own partition WITHOUT writing
 * anything.
 *
 * Products match by name among the user's own products only (a same-named
 * product is updated, otherwise it is added). Quotes and list sends merge by
 * content signature against the user's own history: only the ones not already
 * stored are kept, so importing a backup never duplicates or destroys history.
 */
function createPreviewImport(
  repos: Repositories,
  userId: string,
): (text: string) => Promise<ImportPreview> {
  return async (text) => {
    const { valid, quotes, listSends, errors } = parseProductImport(text);

    const ownProducts = await repos.products.listOwn(userId);
    const toAdd: ProductInput[] = [];
    const toUpdate: { id: number; input: ProductInput }[] = [];

    for (const input of valid) {
      const existing = ownProducts.find((product) => product.nombre === input.nombre);
      if (existing && existing.id) {
        toUpdate.push({ id: existing.id, input });
      } else {
        toAdd.push(input);
      }
    }

    const ownQuotes = await repos.quotes.listOwn(userId);
    const quotesToAdd = unseenBySignature(
      ownQuotes.map(quoteSignature),
      quotes,
      quoteSignature
    );

    const ownSends = await repos.listSends.listOwn(userId);
    const listSendsToAdd = unseenBySignature(
      ownSends.map(listSendSignature),
      listSends,
      listSendSignature
    );

    return { toAdd, toUpdate, quotesToAdd, listSendsToAdd, errors };
  };
}

/**
 * Apply a preview. This is the only import step that writes to the database.
 */
function createApplyImport(
  repos: Repositories,
  userId: string,
): (preview: ImportPreview) => Promise<ImportResult> {
  return async (preview) => {
    const result: ImportResult = {
      success: 0,
      updated: 0,
      quotesAdded: 0,
      listSendsAdded: 0,
      errors: [...preview.errors],
    };

    for (const { id, input } of preview.toUpdate) {
      try {
        await repos.products.update(id, input);
        result.updated++;
      } catch (err) {
        result.errors.push({
          nombre: input.nombre,
          error: err instanceof Error ? err.message : 'Error desconocido.',
        });
      }
    }

    for (const input of preview.toAdd) {
      try {
        await repos.products.create(input);
        result.success++;
      } catch (err) {
        result.errors.push({
          nombre: input.nombre,
          error: err instanceof Error ? err.message : 'Error desconocido.',
        });
      }
    }

    for (const quote of preview.quotesToAdd) {
      try {
        // Drop incoming ids: cross-device ids must not collide.
        await repos.quotes.create({
          fecha: quote.fecha,
          cliente: quote.cliente,
          items: quote.items,
          totalNeto: quote.totalNeto,
          iva: quote.iva,
          total: quote.total,
        });
        result.quotesAdded++;
      } catch (err) {
        result.errors.push({
          nombre: quoteLabel(quote),
          error: err instanceof Error ? err.message : 'Error desconocido.',
        });
      }
    }

    if (preview.listSendsToAdd.length > 0) {
      // Re-check against the user's own sends so a stale preview cannot
      // duplicate a send: apply is itself signature-idempotent. A failed read
      // is reported once and skips the batch, because we cannot dedup safely.
      let unseen: ListSend[] = [];
      try {
        const ownSends = await repos.listSends.listOwn(userId);
        unseen = unseenBySignature(
          ownSends.map(listSendSignature),
          preview.listSendsToAdd,
          listSendSignature
        );
      } catch (err) {
        result.errors.push({
          nombre: '(listas enviadas)',
          error: err instanceof Error ? err.message : 'Error desconocido.',
        });
      }

      // Drop incoming ids: cross-device ids must not collide.
      for (const send of unseen) {
        try {
          await repos.listSends.create({
            fecha: send.fecha,
            cliente: send.cliente,
            items: send.items,
          });
          result.listSendsAdded++;
        } catch (err) {
          result.errors.push({
            nombre: listSendLabel(send),
            error: err instanceof Error ? err.message : 'Error desconocido.',
          });
        }
      }
    }

    return result;
  };
}

/**
 * Build the owner-scoped backup service. `exportBackup` reads the user's own
 * products, quotes and list sends (all three) and downloads the v3 file.
 */
export function createBackupService(repos: Repositories, userId: string): BackupService {
  return {
    async exportBackup() {
      const [products, quotes, listSends] = await Promise.all([
        repos.products.listOwn(userId),
        repos.quotes.listOwn(userId),
        repos.listSends.listOwn(userId),
      ]);
      const backup: BackupFile = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        products,
        quotes,
        listSends,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, backupFilename());
    },

    previewImport: createPreviewImport(repos, userId),

    applyImport: createApplyImport(repos, userId),
  };
}
