import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Force the drafts repo to return a shapeless stored payload (no `items`
// array). The hook must defend against it: a corrupt draft can never become a
// malformed cart, and mounting must not throw.
vi.mock('../../data/local/draftsRepo', () => ({
  DRAFT_STORAGE_KEY: 'produclist:quoteDraft',
  createLocalDraftsRepo: () => ({
    load: () => ({ totalNeto: 1, iva: 0, total: 1 }),
    save: () => undefined,
    clear: () => undefined,
  }),
}));

import { useQuote } from '../useQuote';

describe('useQuote shapeless draft guard', () => {
  it('starts empty and does not throw when the stored draft has no items array', () => {
    const { result } = renderHook(() => useQuote());

    expect(result.current.items).toEqual([]);
  });
});
