import { OwnershipError, type ProductsRepo, type Repositories } from '../ports';
import type { Product, ProductInput } from '../../types/product';

export interface Principal {
  userId: string;
  isAdmin: boolean;
}

function duplicateMessage(nombre: string): string {
  return `Ya existe un producto llamado "${nombre}"`;
}

/**
 * In-memory stand-in for the Supabase products adapter. It mirrors the
 * RLS-visible contract: reads expose own rows (or every owner for an admin),
 * writes only touch rows owned by the principal, and a filtered-out target
 * rejects with `OwnershipError`.
 */
export function createInMemoryProductsRepo(
  principal: Principal,
  seed: ProductInput[] = [],
): ProductsRepo {
  const rows: Product[] = [];
  let nextId = 1;

  const addOwned = (ownerId: string, input: ProductInput): Product => {
    const product: Product = { ...input, id: nextId, ownerId };
    nextId += 1;
    rows.push(product);
    return product;
  };

  for (const input of seed) {
    addOwned(principal.userId, input);
  }

  const ownRows = (userId: string): Product[] =>
    rows.filter((row) => row.ownerId === userId);

  const nameTaken = (ownerId: string, nombre: string, exceptId?: number): boolean =>
    rows.some(
      (row) => row.ownerId === ownerId && row.nombre === nombre && row.id !== exceptId,
    );

  const findOwn = (id: number): Product | undefined =>
    rows.find((row) => row.id === id && row.ownerId === principal.userId);

  return {
    list() {
      const visible = principal.isAdmin ? rows : ownRows(principal.userId);
      return Promise.resolve(visible.map((row) => ({ ...row })));
    },

    listOwn(userId) {
      return Promise.resolve(ownRows(userId).map((row) => ({ ...row })));
    },

    create(input) {
      if (nameTaken(principal.userId, input.nombre)) {
        return Promise.reject(new Error(duplicateMessage(input.nombre)));
      }
      return Promise.resolve({ ...addOwned(principal.userId, input) });
    },

    update(id, changes) {
      const row = findOwn(id);
      if (!row) return Promise.reject(new OwnershipError());
      if (changes.nombre !== undefined && nameTaken(principal.userId, changes.nombre, id)) {
        return Promise.reject(new Error(duplicateMessage(changes.nombre)));
      }
      Object.assign(row, changes);
      return Promise.resolve();
    },

    remove(id) {
      const row = findOwn(id);
      if (!row) return Promise.reject(new OwnershipError());
      rows.splice(rows.indexOf(row), 1);
      return Promise.resolve();
    },

    seedIfEmpty(userId, seedInputs) {
      if (ownRows(userId).length > 0) return Promise.resolve();

      const existingNames = new Set(ownRows(userId).map((row) => row.nombre));
      for (const input of seedInputs) {
        if (existingNames.has(input.nombre)) continue;
        addOwned(userId, input);
        existingNames.add(input.nombre);
      }
      return Promise.resolve();
    },
  };
}

export function createInMemoryRepositories(
  principal: Principal,
  seed: ProductInput[] = [],
): Repositories {
  return { products: createInMemoryProductsRepo(principal, seed) };
}
