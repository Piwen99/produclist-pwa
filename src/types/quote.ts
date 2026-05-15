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