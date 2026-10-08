import { describe, it, expect } from 'vitest';
import { createE2eRepositories } from '../testing/stub';
import { seedProducts } from '../../db/seed';

describe('createE2eRepositories', () => {
  it('seeds the default e2e user with the full product catalog', async () => {
    const repos = createE2eRepositories();

    const products = await repos.products.list();

    expect(products).toHaveLength(seedProducts.length);
    expect(products).toHaveLength(44);
    expect(products.every((product) => product.ownerId === 'e2e-user')).toBe(true);
  });

  it('honors an explicit principal', async () => {
    const repos = createE2eRepositories({ userId: 'admin-e2e', isAdmin: true });

    const products = await repos.products.list();

    expect(products).toHaveLength(44);
    expect(products.every((product) => product.ownerId === 'admin-e2e')).toBe(true);
  });
});
