import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePdfModule } from '../usePdfModule';
import {
  isChunkLoadError,
  hasAttemptedRecovery,
  markRecoveryAttempted,
  clearRecoveryAttempt,
  clearStaleAssets,
  reloadPage,
} from '../pdfModuleRecovery';

vi.mock('../pdfModuleRecovery', () => ({
  isChunkLoadError: vi.fn(),
  hasAttemptedRecovery: vi.fn(),
  markRecoveryAttempted: vi.fn(),
  clearRecoveryAttempt: vi.fn(),
  clearStaleAssets: vi.fn().mockResolvedValue(undefined),
  reloadPage: vi.fn(),
}));

const mockedIsChunkLoadError = vi.mocked(isChunkLoadError);
const mockedHasAttemptedRecovery = vi.mocked(hasAttemptedRecovery);
const mockedMarkRecoveryAttempted = vi.mocked(markRecoveryAttempted);
const mockedClearRecoveryAttempt = vi.mocked(clearRecoveryAttempt);
const mockedClearStaleAssets = vi.mocked(clearStaleAssets);
const mockedReloadPage = vi.mocked(reloadPage);

describe('usePdfModule', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    mockedClearStaleAssets.mockResolvedValue(undefined);
    mockedIsChunkLoadError.mockReturnValue(false);
    mockedHasAttemptedRecovery.mockReturnValue(false);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('resolves to ready with the loaded module on success', async () => {
    const load = () => Promise.resolve({ ok: true });

    const { result } = renderHook(() => usePdfModule(load));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.module).toEqual({ ok: true });
    expect(mockedClearRecoveryAttempt).toHaveBeenCalledTimes(1);
  });

  it('settles on error for a non-chunk failure without reloading', async () => {
    const load = () => Promise.reject(new Error('boom'));

    const { result } = renderHook(() => usePdfModule(load));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.module).toBeNull();
    expect(mockedReloadPage).not.toHaveBeenCalled();
  });

  it('recovers once on a chunk-load failure while online and stays loading', async () => {
    mockedIsChunkLoadError.mockReturnValue(true);
    mockedHasAttemptedRecovery.mockReturnValue(false);
    const load = () => Promise.reject(new Error('chunk'));

    const { result } = renderHook(() => usePdfModule(load));

    await waitFor(() => expect(mockedReloadPage).toHaveBeenCalledTimes(1));
    expect(mockedMarkRecoveryAttempted).toHaveBeenCalledTimes(1);
    expect(mockedClearStaleAssets).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');
  });

  it('settles on error when recovery was already attempted', async () => {
    mockedIsChunkLoadError.mockReturnValue(true);
    mockedHasAttemptedRecovery.mockReturnValue(true);
    const load = () => Promise.reject(new Error('chunk'));

    const { result } = renderHook(() => usePdfModule(load));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mockedReloadPage).not.toHaveBeenCalled();
    expect(mockedMarkRecoveryAttempted).not.toHaveBeenCalled();
  });
});
