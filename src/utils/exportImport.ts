import { addProduct, db } from '../db/database';
import type { Product, ProductInput } from '../types/product';

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

/**
 * Export all products as a JSON file.
 */
export function exportToJSON(products: Product[]): void {
  const json = JSON.stringify(products, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, 'produclist-productos.json');
}

/**
 * Export all products as a CSV file (compatible with Excel).
 * Columns: nombre, categoria, formato, precioNeto, disponible
 */
export function exportToCSV(products: Product[]): void {
  const headers = ['nombre', 'categoria', 'formato', 'precioNeto', 'disponible'];
  const rows = products.map(p => [
    `"${p.nombre}"`,
    `"${p.categoria}"`,
    `"${p.formato}"`,
    p.precioNeto,
    p.disponible ? 'SI' : 'NO',
  ].join(','));

  const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, 'produclist-productos.csv');
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  success: number;
  updated: number;
  errors: { nombre: string; error: string }[];
}

/**
 * Import products from a JSON file.
 *
 * Strategy: match by product name — if a product with the same name exists,
 * update it; otherwise add it as new. This allows exporting from one device
 * and importing into another without ID conflicts.
 */
export async function importProducts(file: File): Promise<ImportResult> {
  const text = await file.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }

  if (!Array.isArray(data)) {
    throw new Error('El archivo debe contener un arreglo de productos.');
  }

  const result: ImportResult = { success: 0, updated: 0, errors: [] };

  for (const item of data) {
    const raw = item as Record<string, unknown>;

    // Validate required fields
    if (!raw.nombre || typeof raw.nombre !== 'string') {
      result.errors.push({ nombre: '(sin nombre)', error: 'Campo "nombre" obligatorio.' });
      continue;
    }

    if (!raw.categoria || typeof raw.categoria !== 'string') {
      const name = typeof raw.nombre === 'string' ? raw.nombre : '(sin nombre)';
      result.errors.push({ nombre: name, error: 'Campo "categoria" obligatorio.' });
      continue;
    }

    const rawNombre = raw.nombre;
    const rawCategoria = raw.categoria;
    const rawFormato = raw.formato;
    const rawPrecioNeto = raw.precioNeto;

    const productInput: ProductInput = {
      nombre: typeof rawNombre === 'string' ? rawNombre.trim() : '',
      categoria: rawCategoria as ProductInput['categoria'],
      formato: typeof rawFormato === 'string' ? rawFormato : '',
      precioNeto: typeof rawPrecioNeto === 'number' ? rawPrecioNeto : Number(rawPrecioNeto) || 0,
      disponible: raw.disponible !== false,
    };

    try {
      // Match by name: check if a product with this name already exists
      const existing = await db.products
        .where('nombre')
        .equals(productInput.nombre)
        .first();

      if (existing && existing.id) {
        // Update existing product
        await db.products.update(existing.id, productInput);
        result.updated++;
      } else {
        // Add new product
        await addProduct(productInput);
        result.success++;
      }
    } catch (err) {
      result.errors.push({
        nombre: productInput.nombre,
        error: err instanceof Error ? err.message : 'Error desconocido.',
      });
    }
  }

  return result;
}
