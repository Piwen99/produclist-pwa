import { addProduct, db, type SavedQuote } from '../db/database';
import type { Product, ProductInput, Category } from '../types/product';
import type { QuoteItem } from '../types/quote';
import { isValidChileanFormat } from './price';
import { markBackedUp } from './backupReminder';

const CATEGORY_VALUES: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

/** Version of the backup file format written by `exportBackup`. */
export const BACKUP_VERSION = 2;

/**
 * Backup file format v2: the whole local database in one file.
 * A bare array of products (v1) is still accepted on import.
 */
export interface BackupFile {
  version: number;
  exportedAt: string;
  products: Product[];
  quotes: SavedQuote[];
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
 * Export products AND saved quotes as one JSON backup file.
 *
 * CSV export was removed — not used and unnecessarily double-quoted names.
 */
export async function exportBackup(products: Product[]): Promise<void> {
  const quotes = await db.quotes.toArray();
  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    quotes,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  downloadBlob(blob, backupFilename());
  // Any export counts as a backup — the reminder resets from here.
  markBackedUp();
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  success: number;
  updated: number;
  quotesAdded: number;
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

/**
 * Parse and validate the text of a JSON import file.
 *
 * Accepts both backup formats: v2 (an object with `products` and `quotes`) and
 * the legacy v1 (a bare array of products). Pure: no database access, nothing
 * is written. Throws only when the file is not valid JSON or has no products.
 */
export function parseProductImport(text: string): {
  valid: ProductInput[];
  quotes: SavedQuote[];
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

  return { valid, quotes, errors };
}

/**
 * Match a validated import against the current database WITHOUT writing anything.
 *
 * Products match by name (a product with the same name is updated, otherwise it
 * is added). Quotes merge by content: only the ones this device does not already
 * have are kept, so importing a backup never duplicates or destroys history.
 */
export async function previewImport(text: string): Promise<ImportPreview> {
  const { valid, quotes, errors } = parseProductImport(text);

  const toAdd: ProductInput[] = [];
  const toUpdate: { id: number; input: ProductInput }[] = [];

  for (const input of valid) {
    const existing = await db.products.where('nombre').equals(input.nombre).first();
    if (existing && existing.id) {
      toUpdate.push({ id: existing.id, input });
    } else {
      toAdd.push(input);
    }
  }

  const existingQuotes = await db.quotes.toArray();
  const seen = new Set(existingQuotes.map(quoteSignature));
  const quotesToAdd: SavedQuote[] = [];

  for (const quote of quotes) {
    const signature = quoteSignature(quote);
    if (seen.has(signature)) continue;
    seen.add(signature);
    quotesToAdd.push(quote);
  }

  return { toAdd, toUpdate, quotesToAdd, errors };
}

/**
 * Apply a preview. This is the only import step that writes to the database.
 */
export async function applyImport(preview: ImportPreview): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    updated: 0,
    quotesAdded: 0,
    errors: [...preview.errors],
  };

  for (const { id, input } of preview.toUpdate) {
    try {
      await db.products.update(id, input);
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
      await addProduct(input);
      result.success++;
    } catch (err) {
      result.errors.push({
        nombre: input.nombre,
        error: err instanceof Error ? err.message : 'Error desconocido.',
      });
    }
  }

  if (preview.quotesToAdd.length > 0) {
    try {
      // Drop ids so Dexie assigns fresh ones: cross-device ids must not collide.
      await db.quotes.bulkAdd(
        preview.quotesToAdd.map((quote) => ({
          fecha: quote.fecha,
          items: quote.items,
          totalNeto: quote.totalNeto,
          iva: quote.iva,
          total: quote.total,
        }))
      );
      result.quotesAdded = preview.quotesToAdd.length;
    } catch (err) {
      result.errors.push({
        nombre: '(cotizaciones)',
        error: err instanceof Error ? err.message : 'Error desconocido.',
      });
    }
  }

  return result;
}
