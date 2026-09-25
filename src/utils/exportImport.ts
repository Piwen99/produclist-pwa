import { addProduct, db } from '../db/database';
import type { Product, ProductInput, Category } from '../types/product';
import { isValidChileanFormat } from './price';
import { markBackedUp } from './backupReminder';

const CATEGORY_VALUES: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

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

/* Export all products as a JSON file.
 *
 * CSV export was removed — not used and unnecessarily double-quoted names.
 */
export function exportToJSON(products: Product[]): void {
  const json = JSON.stringify(products, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, 'produclist-productos.json');
  // Any export counts as a backup — the reminder resets from here.
  markBackedUp();
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  success: number;
  updated: number;
  errors: ImportError[];
}

export interface ImportError {
  nombre: string;
  error: string;
}

/**
 * A validated import matched against the current catalog, ready to apply.
 * Building a preview never writes to the database — see `applyImport`.
 */
export interface ImportPreview {
  toAdd: ProductInput[];
  toUpdate: { id: number; input: ProductInput }[];
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
 * Parse and validate the text of a JSON import file.
 * Pure: no database access, nothing is written. Throws only when the file is
 * not valid JSON or is not an array.
 */
export function parseProductImport(text: string): {
  valid: ProductInput[];
  errors: ImportError[];
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }

  if (!Array.isArray(data)) {
    throw new Error('El archivo debe contener un arreglo de productos.');
  }

  const valid: ProductInput[] = [];
  const errors: ImportError[] = [];

  for (const entry of data) {
    const parsed = parseImportItem(entry);
    if ('error' in parsed) {
      errors.push(parsed);
    } else {
      valid.push(parsed);
    }
  }

  return { valid, errors };
}

/**
 * Match a validated import against the current catalog WITHOUT writing anything.
 *
 * Strategy: match by product name — if a product with the same name exists it
 * will be updated; otherwise it will be added. This allows exporting from one
 * device and importing into another without ID conflicts, and lets the UI show
 * exactly how many products would be overwritten before anything is applied.
 */
export async function previewImport(text: string): Promise<ImportPreview> {
  const { valid, errors } = parseProductImport(text);
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

  return { toAdd, toUpdate, errors };
}

/**
 * Apply a preview. This is the only import step that writes to the database.
 */
export async function applyImport(preview: ImportPreview): Promise<ImportResult> {
  const result: ImportResult = { success: 0, updated: 0, errors: [...preview.errors] };

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

  return result;
}
