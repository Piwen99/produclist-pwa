import type { QuoteDraft } from '../../types/quote';

export interface DraftsRepo {
  /** Returns the stored draft, or null when absent or unreadable. */
  load(): QuoteDraft | null;
  save(draft: Omit<QuoteDraft, 'id'>): void;
  clear(): void;
}

/** Legacy device-wide key. Kept only to clean it up on sign-out. */
export const DRAFT_STORAGE_KEY = 'produclist:quoteDraft';

/**
 * One draft per user on the same device (issue #90). A device-wide key let a
 * second vendor inherit the previous cart: product names, per-kg prices and
 * totals. The user id is part of the key, so the draft is only ever restored
 * for its owner.
 */
export function draftStorageKey(userId?: string | null): string {
  return userId ? `${DRAFT_STORAGE_KEY}:${userId}` : DRAFT_STORAGE_KEY;
}

/**
 * Per-tab in-memory stand-in for a storage that refuses access. Reads fall back
 * to it and writes land here first, so the cotizador keeps working.
 */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

/**
 * The bare `localStorage` accessor itself can throw (blocked storage, some
 * privacy modes). Reading it lazily and inside a guard keeps that from turning
 * a render into the top-level error screen.
 */
function defaultStorage(): Storage {
  if (typeof window === 'undefined') return createMemoryStorage();
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

/**
 * Single-slot quote draft persisted in `localStorage` (or any `Storage`).
 * Deliberately local-only: drafts survive refresh even offline and are excluded
 * from backups. Corrupt data is treated as "no draft", and a storage that
 * rejects a single operation degrades to the in-memory copy instead of throwing
 * during render.
 */
export function createLocalDraftsRepo(
  storage?: Storage,
  key = DRAFT_STORAGE_KEY,
): DraftsRepo {
  const raw = storage ?? defaultStorage();
  const memory = createMemoryStorage();

  const read = (): string | null => {
    try {
      const value = raw.getItem(key);
      if (value !== null) return value;
    } catch {
      // Fall through to the in-memory copy.
    }
    return memory.getItem(key);
  };

  const write = (value: string): void => {
    memory.setItem(key, value);
    try {
      raw.setItem(key, value);
    } catch (error) {
      // The in-memory copy keeps this tab working, but the failure is not
      // silent: a draft that only exists in memory is lost on reload.
      console.error('[draftsRepo] No se pudo persistir el borrador', error);
    }
  };

  const drop = (): void => {
    memory.removeItem(key);
    try {
      raw.removeItem(key);
    } catch (error) {
      // Nothing else to do: the in-memory copy is gone.
      console.error('[draftsRepo] No se pudo borrar el borrador', error);
    }
  };

  return {
    load() {
      const stored = read();
      if (stored === null) return null;
      try {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return null;
        }
        const candidate = parsed as Omit<QuoteDraft, 'id'>;
        if (!Array.isArray(candidate.items)) return null;
        return { id: 'draft', ...candidate };
      } catch {
        return null;
      }
    },
    save(draft) {
      write(JSON.stringify(draft));
    },
    clear() {
      drop();
    },
  };
}

/**
 * Remove one user's draft, plus the legacy device-wide key. Called on sign-out:
 * the persisted cart must not survive the session that created it.
 */
export function clearDraftFor(
  userId?: string | null,
  storage?: Storage,
): void {
  createLocalDraftsRepo(storage, draftStorageKey(userId)).clear();
  if (userId) {
    createLocalDraftsRepo(storage, DRAFT_STORAGE_KEY).clear();
  }
}
