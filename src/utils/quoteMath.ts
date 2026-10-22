import type { QuoteItem, QuoteTotals } from '../types/quote';
import { tryParseChileanNumber } from './price';

/**
 * Single source of truth for quote line maths.
 *
 * Money contract (issue #95): every line is rounded to whole pesos and the
 * subtotal is the sum of those rounded lines, so the amounts printed on the
 * client document add up exactly. IVA and total derive from that same rounded
 * base. CLP has no minor unit, so a fractional peso cannot be displayed.
 *
 * Validity contract (issue #94): a line whose `formato` is missing or invalid
 * yields `null` — never a silent 0. Callers must surface it instead of pricing
 * the line at zero.
 */

/** Round to whole pesos. All monetary aggregation goes through here. */
function toPesos(amount: number): number {
  return Math.round(amount);
}

/**
 * Kilograms contributed by one line, or `null` when the line cannot be priced.
 * Guards the type because an imported backup can carry a non-string `formato`.
 */
export function lineKg(item: QuoteItem): number | null {
  if (typeof item.formato !== 'string') return null;
  const perUnit = tryParseChileanNumber(item.formato);
  if (perUnit === null) return null;
  return perUnit * item.cantidad;
}

/**
 * Line amount in whole pesos, or `null` when the line cannot be priced.
 * Rounded per line: this is what the cart, the PDF and the share text print.
 */
export function lineSubtotal(item: QuoteItem): number | null {
  const kg = lineKg(item);
  if (kg === null) return null;
  return toPesos(kg * item.precioKg);
}

/** Whether a line carries a usable price. */
export function isPriceableLine(item: QuoteItem): boolean {
  return lineKg(item) !== null;
}

/** The lines that cannot be priced, in cart order. */
export function invalidLines(items: QuoteItem[]): QuoteItem[] {
  return items.filter((item) => !isPriceableLine(item));
}

/**
 * Quote totals from the same per-line rounded amounts the document prints.
 * An unpriceable line is skipped; it never contributes a silent zero.
 */
export function computeQuoteTotals(items: QuoteItem[]): QuoteTotals {
  let totalKg = 0;
  let subtotal = 0;

  for (const item of items) {
    const kg = lineKg(item);
    if (kg === null) continue;
    totalKg += kg;
    subtotal += toPesos(kg * item.precioKg);
  }

  const iva = Math.round(subtotal * 0.19);
  return { totalKg, subtotal, iva, total: subtotal + iva };
}
