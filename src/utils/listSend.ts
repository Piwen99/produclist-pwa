import { calcPrecioBruto } from './price';
import type { Product } from '../types/product';
import type { ListSendItem } from '../types/listSend';

/**
 * Snapshot the available catalog into the items of a list send.
 *
 * Prices are captured as they are right now — see the `ListSend` docs for why
 * this is a snapshot and not a reference to the products table.
 */
export function buildListSendItems(products: Product[]): ListSendItem[] {
  return products
    .filter((product) => product.disponible)
    .map((product) => ({
      nombre: product.nombre,
      formato: product.formato,
      precioNeto: product.precioNeto,
      precioBruto: calcPrecioBruto(product.precioNeto),
    }));
}
