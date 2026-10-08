import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repositories } from '../ports';
import { createClientsRepo, type ClientsClient } from './clientsRepo';
import { createListSendsRepo, type ListSendsClient } from './listSendsRepo';
import { createProductsRepo, type ProductsClient } from './productsRepo';
import { createQuotesRepo, type QuotesClient } from './quotesRepo';

/**
 * Compose every Supabase-backed adapter into the `Repositories` port set.
 *
 * The adapters declare narrow structural client types so they stay unit
 * testable; the real supabase-js client is wider, so it is cast once here at
 * the composition boundary. No `userId` is captured: the owner-scoped reads
 * take `listOwn(userId)` at call time and writes rely on the `auth.uid()`
 * column default under RLS.
 */
export function createSupabaseRepositories(client: SupabaseClient): Repositories {
  return {
    products: createProductsRepo(client as unknown as ProductsClient),
    quotes: createQuotesRepo(client as unknown as QuotesClient),
    listSends: createListSendsRepo(client as unknown as ListSendsClient),
    clients: createClientsRepo(client as unknown as ClientsClient),
  };
}
