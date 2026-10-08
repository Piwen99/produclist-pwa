import type { QuoteItem } from '../../types/quote';
import type { ListSendItem } from '../../types/listSend';

/** Snake_case shapes of the `public.productos` table (PostgREST response rows). */
export interface ProductRow {
  id: number;
  nombre: string;
  categoria: string;
  formato: string;
  precio_neto: number;
  disponible: boolean;
  owner_id: string;
  created_at: string;
}

/**
 * Insert payload for `public.productos`. `id` and `created_at` are database
 * generated; `owner_id` is optional because the column defaults to auth.uid().
 */
export interface ProductInsert {
  nombre: string;
  categoria: string;
  formato: string;
  precio_neto: number;
  disponible: boolean;
  owner_id?: string;
}

/** Snake_case shape of the `public.cotizaciones` table. */
export interface QuoteRow {
  id: number;
  fecha: string;
  cliente: string | null;
  items: QuoteItem[];
  total_neto: number;
  iva: number;
  total: number;
  owner_id: string;
  created_at: string;
}

/** Insert payload for `public.cotizaciones`; `owner_id` defaults to auth.uid(). */
export interface QuoteInsert {
  fecha: string;
  cliente: string | null;
  items: QuoteItem[];
  total_neto: number;
  iva: number;
  total: number;
  owner_id?: string;
}

/** Snake_case shape of the `public.listas_enviadas` table. */
export interface ListSendRow {
  id: number;
  fecha: string;
  cliente: string;
  items: ListSendItem[];
  owner_id: string;
  created_at: string;
}

/** Insert payload for `public.listas_enviadas`; `owner_id` defaults to auth.uid(). */
export interface ListSendInsert {
  fecha: string;
  cliente: string;
  items: ListSendItem[];
  owner_id?: string;
}
