import type { QuoteDraft } from '../../types/quote';

export interface DraftsRepo {
  /** Returns the stored draft, or null when absent or unreadable. */
  load(): QuoteDraft | null;
  save(draft: Omit<QuoteDraft, 'id'>): void;
  clear(): void;
}

export const DRAFT_STORAGE_KEY = 'produclist:quoteDraft';

/**
 * Single-slot quote draft persisted in `localStorage` (or any `Storage`).
 * Deliberately local-only: drafts survive refresh even offline and are excluded
 * from backups. Corrupt data is treated as "no draft".
 */
export function createLocalDraftsRepo(
  storage: Storage = localStorage,
  key = DRAFT_STORAGE_KEY,
): DraftsRepo {
  return {
    load() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
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
      storage.setItem(key, JSON.stringify(draft));
    },
    clear() {
      storage.removeItem(key);
    },
  };
}
