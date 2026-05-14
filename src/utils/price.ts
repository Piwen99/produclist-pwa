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
