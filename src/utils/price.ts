/**
 * Calculate gross price (precio bruto) from net price (precio neto)
 * Applies 19% VAT/IVA (Chile)
 * @param precioNeto - Net price
 * @returns Gross price (neto × 1.19)
 */
export function calcPrecioBruto(precioNeto: number): number {
  return Math.round(precioNeto * 1.19);
}
