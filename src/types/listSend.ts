export interface ListSendItem {
  /** Product name at the time of sending */
  nombre: string;
  /** Chilean decimal format, e.g. "11,34" */
  formato: string;
  /** Net price per kg at the time of sending */
  precioNeto: number;
  /** Gross price (neto x 1.19) at the time of sending */
  precioBruto: number;
}

/**
 * A snapshot of the price list sent to a client.
 *
 * Prices are stored as they were at the moment of sending, NOT as references to
 * the catalog: what a client was told is a historical fact and must not change
 * when the catalog changes later. The client name is free text typed by the
 * user (see `getClientNames` for the autocomplete source).
 */
export interface ListSend {
  id?: number;
  fecha: Date;
  cliente: string;
  items: ListSendItem[];
}
