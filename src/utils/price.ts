/**
 * Parse Chilean decimal format string to number
 * Replaces comma with period and parses as float
 * @param formato - Chilean decimal string (e.g., "11,34")
 * @returns Parsed number, or 0 if invalid
 */
export function parseChileanNumber(formato: string): number {
  if (!formato) return 0;
  const parsed = parseFloat(formato.replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

/** Alias for parseChileanNumber — used in quote calculations */
export const parseFormato = parseChileanNumber;

/**
 * Calculate gross price (precio bruto) from net price (precio neto)
 * Applies 19% VAT/IVA (Chile)
 * @param precioNeto - Net price
 * @returns Gross price (neto × 1.19)
 */
export function calcPrecioBruto(precioNeto: number): number {
  return Math.round(precioNeto * 1.19);
}

/**
 * Calculate total price from formato and precioBruto
 * Parses Chilean decimal format (comma as decimal separator) and multiplies
 * @param formato - Chilean decimal string (e.g., "11,34")
 * @param precioBruto - Gross price
 * @returns Total (formato parsed as float × precioBruto, rounded)
 */
export function calcTotal(formato: string, precioBruto: number): number {
  if (!formato || precioBruto === 0) return 0;
  const parsed = parseFloat(formato.replace(',', '.'));
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * precioBruto);
}

/**
 * Format a number as Chilean CLP currency
 * Uses Intl.NumberFormat with es-CL locale
 * @param amount - Number to format
 * @returns Formatted string like "$247.615"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
