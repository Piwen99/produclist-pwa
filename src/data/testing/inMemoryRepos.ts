import {
  OwnershipError,
  type ClientsRepo,
  type ListSendsRepo,
  type ProductsRepo,
  type QuotesRepo,
  type Repositories,
} from '../ports';
import type { Product, ProductInput } from '../../types/product';
import type { SavedQuote } from '../../types/quote';
import type { ListSend } from '../../types/listSend';
import { mergeClientNames } from '../../utils/clientNames';

export interface Principal {
  userId: string;
  isAdmin: boolean;
}

function duplicateMessage(nombre: string): string {
  return `Ya existe un producto llamado "${nombre}"`;
}

function nextIdAfter(rows: { id?: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id ?? 0), 0) + 1;
}

/** Newest first by fecha, mirroring the adapter's `order('fecha')` read. */
function byFechaDesc<T extends { fecha: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
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

/**
 * In-memory stand-in for the Supabase quotes adapter. Mirrors the RLS-visible
 * contract: reads expose own rows (or every owner for an admin), `create`
 * attributes to the principal, and removing a foreign/missing row rejects with
 * `OwnershipError`. Rows are returned newest first by `fecha`.
 */
export function createInMemoryQuotesRepo(
  principal: Principal,
  seed: SavedQuote[] = [],
): QuotesRepo {
  const rows: SavedQuote[] = seed.map((row) => ({ ...row }));
  let nextId = nextIdAfter(rows);

  const ownRows = (userId: string): SavedQuote[] =>
    rows.filter((row) => row.ownerId === userId);

  return {
    list() {
      const visible = principal.isAdmin ? rows : ownRows(principal.userId);
      return Promise.resolve(byFechaDesc(visible).map((row) => ({ ...row })));
    },

    listOwn(userId) {
      return Promise.resolve(byFechaDesc(ownRows(userId)).map((row) => ({ ...row })));
    },

    create(data) {
      const quote: SavedQuote = {
        id: nextId,
        fecha: data.fecha ?? new Date(),
        cliente: data.cliente,
        items: data.items,
        totalNeto: data.totalNeto,
        iva: data.iva,
        total: data.total,
        ownerId: principal.userId,
      };
      nextId += 1;
      rows.push(quote);
      return Promise.resolve({ ...quote });
    },

    remove(id) {
      const row = rows.find((r) => r.id === id && r.ownerId === principal.userId);
      if (!row) return Promise.reject(new OwnershipError());
      rows.splice(rows.indexOf(row), 1);
      return Promise.resolve();
    },
  };
}

/**
 * In-memory stand-in for the Supabase list-sends adapter. Same RLS contract as
 * `createInMemoryQuotesRepo`, newest first by `fecha`.
 */
export function createInMemoryListSendsRepo(
  principal: Principal,
  seed: ListSend[] = [],
): ListSendsRepo {
  const rows: ListSend[] = seed.map((row) => ({ ...row }));
  let nextId = nextIdAfter(rows);

  const ownRows = (userId: string): ListSend[] =>
    rows.filter((row) => row.ownerId === userId);

  return {
    list() {
      const visible = principal.isAdmin ? rows : ownRows(principal.userId);
      return Promise.resolve(byFechaDesc(visible).map((row) => ({ ...row })));
    },

    listOwn(userId) {
      return Promise.resolve(byFechaDesc(ownRows(userId)).map((row) => ({ ...row })));
    },

    create(data) {
      const send: ListSend = {
        id: nextId,
        fecha: data.fecha ?? new Date(),
        cliente: data.cliente,
        items: data.items,
        ownerId: principal.userId,
      };
      nextId += 1;
      rows.push(send);
      return Promise.resolve({ ...send });
    },

    remove(id) {
      const row = rows.find((r) => r.id === id && r.ownerId === principal.userId);
      if (!row) return Promise.reject(new OwnershipError());
      rows.splice(rows.indexOf(row), 1);
      return Promise.resolve();
    },
  };
}

/**
 * In-memory stand-in for the Supabase clients adapter: the RLS-visible union of
 * client names, read through the quotes and list-sends ports so an admin sees
 * every owner's names and a vendor only their own.
 */
export function createInMemoryClientsRepo(
  quotes: QuotesRepo,
  listSends: ListSendsRepo,
): ClientsRepo {
  return {
    async listNames() {
      const [visibleQuotes, visibleSends] = await Promise.all([
        quotes.list(),
        listSends.list(),
      ]);
      return mergeClientNames(visibleQuotes, visibleSends);
    },
  };
}

export function createInMemoryRepositories(
  principal: Principal,
  seed: ProductInput[] = [],
): Repositories {
  const quotes = createInMemoryQuotesRepo(principal);
  const listSends = createInMemoryListSendsRepo(principal);
  return {
    products: createInMemoryProductsRepo(principal, seed),
    quotes,
    listSends,
    clients: createInMemoryClientsRepo(quotes, listSends),
  };
}
