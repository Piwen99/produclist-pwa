import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isChunkLoadError,
  hasAttemptedRecovery,
  markRecoveryAttempted,
  clearRecoveryAttempt,
  clearStaleAssets,
  reloadPage,
} from '../pdfModuleRecovery';

describe('isChunkLoadError', () => {
  it('recognizes the Vite dynamic import failure message', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
      ),
    ).toBe(true);
  });

  it('recognizes the "error loading dynamically imported module" message', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('recognizes the "Importing a module script failed." message', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('recognizes the webpack "Loading chunk N failed." message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 3 failed.'))).toBe(true);
  });

  it('recognizes a ChunkLoadError by name', () => {
    expect(isChunkLoadError({ name: 'ChunkLoadError' })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('recovery guard', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearRecoveryAttempt();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('is false, then true after marking, then false after clearing', () => {
    expect(hasAttemptedRecovery()).toBe(false);
    expect(markRecoveryAttempted()).toBe(true);
    expect(hasAttemptedRecovery()).toBe(true);
    clearRecoveryAttempt();
    expect(hasAttemptedRecovery()).toBe(false);
  });

  it('returns false when sessionStorage.setItem throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });

    expect(markRecoveryAttempted()).toBe(false);
    expect(hasAttemptedRecovery()).toBe(false);

    setItem.mockRestore();
  });
});

describe('clearStaleAssets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves without service worker or caches support', async () => {
    await expect(clearStaleAssets()).resolves.toBeUndefined();
  });

  it('unregisters every service worker and deletes every cache', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
      configurable: true,
    });
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: del,
    });

    await expect(clearStaleAssets()).resolves.toBeUndefined();

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(2);

    if (originalDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', originalDescriptor);
    } else {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });
});

describe('reloadPage', () => {
  it('reloads the window', () => {
    const originalLocation = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });

    reloadPage();

    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
