export interface QuoteItem {
  /** Client-side UUID for key/reorder/remove */
  id: string;
  /** From Dexie products table */
  productId: number;
  /** Product name */
  nombre: string;
  /** Chilean decimal format, e.g. "11,34" */
  formato: string;
  /** User input, units (integer >= 1) */
  cantidad: number;
  /** User input, CLP/kg, NO IVA */
  precioKg: number;
}

export interface QuoteTotals {
  /** Sum of (parseFloat(formato) * cantidad) for all items */
  totalKg: number;
  /** Sum of (totalKg_i * precioKg_i) for all items */
  subtotal: number;
  /** subtotal * 0.19 */
  iva: number;
  /** subtotal + iva */
  total: number;
}

export interface SavedQuote {
  id?: number;
  fecha: Date;
  /** Free text typed by the user; optional. */
  cliente?: string;
  items: QuoteItem[];
  totalNeto: number;
  iva: number;
  total: number;
  ownerId?: string;
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