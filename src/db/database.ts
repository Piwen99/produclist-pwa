import Dexie, { type Table } from 'dexie';
import type { Product, ProductInput } from '../types/product';
import type { QuoteItem } from '../types/quote';

export class ProduclistDB extends Dexie {
  products!: Table<Product>;
  quotes!: Table<SavedQuote>;
  drafts!: Table<QuoteDraft>;

  constructor() {
    super('ProduclistDB');
    this.version(1).stores({
      products: '++id, nombre, categoria, disponible'
    });
    this.version(2).stores({
      products: '++id, nombre, categoria, disponible',
      quotes: '++id, fecha'
    });
    this.version(3).stores({
      products: '++id, nombre, categoria, disponible',
      quotes: '++id, fecha',
      // Borrador único de cotización (autosave). Una sola fila con clave fija.
      drafts: 'id'
    });
  }
}

export interface SavedQuote {
  id?: number;
  fecha: Date;
  items: QuoteItem[];
  totalNeto: number;
  iva: number;
  total: number;
}

// Borrador de cotización (autosave): misma forma que SavedQuote pero sin
// fecha y con una fila única de clave fija.
export interface QuoteDraft {
  id: 'draft';
  items: QuoteItem[];
  totalNeto: number;
  iva: number;
  total: number;
}

export const DRAFT_KEY = 'draft' as const;

export const db = new ProduclistDB();

// CRUD Helpers
export async function addProduct(product: ProductInput): Promise<number> {
  // Prevent duplicates by name
  const existing = await db.products.where('nombre').equals(product.nombre).first();
  if (existing) {
    throw new Error(`Ya existe un producto llamado "${product.nombre}"`);
  }

  const id: number = await db.products.add({
    ...product,
    disponible: product.disponible,
  }) as number;
  return id;
}

export async function updateProduct(id: number, changes: Partial<ProductInput>): Promise<void> {
  // If renaming, check the new name doesn't conflict with another product
  if (changes.nombre) {
    const existing = await db.products.where('nombre').equals(changes.nombre).first();
    if (existing && existing.id !== id) {
      throw new Error(`Ya existe un producto llamado "${changes.nombre}"`);
    }
  }
  await db.products.update(id, changes);
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id);
}

export async function getAllProducts(): Promise<Product[]> {
  return await db.products.toArray();
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return await db.products.get(id);
}

/**
 * Remove duplicate products by name, keeping the entry with the lowest ID.
 * Safe to call multiple times (idempotent).
 */
export async function deduplicateProducts(): Promise<number> {
  const allProducts = await db.products.toArray();
  const seen = new Map<string, number[]>();

  for (const p of allProducts) {
    const productId = p.id;
    if (productId === undefined) continue;
    const ids = seen.get(p.nombre) ?? [];
    ids.push(productId);
    seen.set(p.nombre, ids);
  }

  const toDelete: number[] = [];
  for (const [, ids] of seen) {
    if (ids.length > 1) {
      ids.sort((a, b) => a - b);
      toDelete.push(...ids.slice(1));
    }
  }

  if (toDelete.length > 0) {
    await db.products.bulkDelete(toDelete);
    console.log(`[Dedup] Removed ${String(toDelete.length)} duplicate products`);
  }

  return toDelete.length;
}

// Quote CRUD Helpers

/**
 * Save a new quote with the current date (or provided date)
 */
export async function saveQuote(
  data: Omit<SavedQuote, 'id' | 'fecha'> & { fecha?: Date }
): Promise<number> {
  const id = await db.quotes.add({
    fecha: data.fecha ?? new Date(),
    items: data.items,
    totalNeto: data.totalNeto,
    iva: data.iva,
    total: data.total,
  }) as number;
  return id;
}

/**
 * Get all quotes ordered by fecha descending (newest first)
 */
export async function getAllQuotes(): Promise<SavedQuote[]> {
  const quotes = await db.quotes.orderBy('fecha').toArray();
  return quotes.reverse();
}

/**
 * Delete a quote by id
 */
export async function deleteQuote(id: number): Promise<void> {
  await db.quotes.delete(id);
}

// ── Quote draft (autosave del cotizador) ──────────────────────────────────

/**
 * Persist the current quote as a single-slot draft (last-write-wins).
 * Llamado con debounce desde el cotizador: sobrevive refresh/navegación.
 */
export async function saveQuoteDraft(
  data: Omit<QuoteDraft, 'id'>
): Promise<void> {
  await db.drafts.put({ id: DRAFT_KEY, ...data });
}

/**
 * Load the saved draft, or undefined if none exists.
 */
export async function loadQuoteDraft(): Promise<QuoteDraft | undefined> {
  return await db.drafts.get(DRAFT_KEY);
}

/**
 * Remove the draft (after saving the quote or clearing the cotizador).
 */
export async function clearQuoteDraft(): Promise<void> {
  await db.drafts.delete(DRAFT_KEY);
}