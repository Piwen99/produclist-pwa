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
