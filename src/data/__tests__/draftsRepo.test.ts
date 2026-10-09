import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLocalDraftsRepo, DRAFT_STORAGE_KEY } from '../local/draftsRepo';
import type { QuoteDraft } from '../../types/quote';
import type { QuoteItem } from '../../types/quote';

const ITEM: QuoteItem = {
  id: 'i1',
  productId: 1,
  nombre: 'Almendras',
  formato: '1',
  cantidad: 2,
  precioKg: 1000,
};

const DRAFT: Omit<QuoteDraft, 'id'> = {
  items: [ITEM],
  totalNeto: 2000,
  iva: 380,
  total: 2380,
};

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('createLocalDraftsRepo', () => {
  it('returns null when no draft has been stored', () => {
    expect(createLocalDraftsRepo().load()).toBeNull();
  });

  it('round-trips a saved draft with the fixed id', () => {
    const repo = createLocalDraftsRepo();

    repo.save(DRAFT);

    expect(repo.load()).toEqual({ id: 'draft', ...DRAFT });
  });

  it('survives a refresh: a new repo over the same storage sees the draft', () => {
    createLocalDraftsRepo().save(DRAFT);

    expect(createLocalDraftsRepo().load()).toEqual({ id: 'draft', ...DRAFT });
  });

  it('clears the stored draft', () => {
    const repo = createLocalDraftsRepo();
    repo.save(DRAFT);

    repo.clear();

    expect(repo.load()).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('returns null for corrupt, unparseable data', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, '{not valid json');

    expect(createLocalDraftsRepo().load()).toBeNull();
  });

  it.each([
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"draft"'],
    ['an array', '[]'],
  ])('returns null for parseable non-object payload (%s)', (_label, payload) => {
    localStorage.setItem(DRAFT_STORAGE_KEY, payload);

    expect(createLocalDraftsRepo().load()).toBeNull();
  });

  it('returns null for a shapeless object without an items array', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ totalNeto: 1, iva: 0, total: 1 }));

    expect(createLocalDraftsRepo().load()).toBeNull();
  });

  it('returns null when items is present but not an array', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ items: 'nope', totalNeto: 1 }));

    expect(createLocalDraftsRepo().load()).toBeNull();
  });

  it('honors a custom storage and key', () => {
    const storage = createMemoryStorage();
    const repo = createLocalDraftsRepo(storage, 'custom:key');

    repo.save(DRAFT);

    expect(storage.getItem('custom:key')).not.toBeNull();
    expect(repo.load()).toEqual({ id: 'draft', ...DRAFT });
  });
});
