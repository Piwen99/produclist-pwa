import { seedProducts } from '../seedProducts';
import type { Repositories } from '../ports';
import { createInMemoryRepositories, type Principal } from './inMemoryRepos';

/**
 * `VITE_E2E` data stub: a credential-free repository set seeded with the base
 * catalog, owned by the synthetic e2e principal. Used by later wiring so e2e
 * runs never need Supabase secrets.
 */
export function createE2eRepositories(
  principal: Principal = { userId: 'e2e-user', isAdmin: false },
): Repositories {
  return createInMemoryRepositories(principal, seedProducts);
}
