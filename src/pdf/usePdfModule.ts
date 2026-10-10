import { useCallback, useEffect, useState } from 'react';
import {
  clearRecoveryAttempt,
  clearStaleAssets,
  hasAttemptedRecovery,
  isChunkLoadError,
  markRecoveryAttempted,
  reloadPage,
} from './pdfModuleRecovery';

const RELOAD_FALLBACK_MS = 5000;

export type PdfModuleStatus = 'loading' | 'ready' | 'error';

export interface PdfModuleState<T> {
  status: PdfModuleStatus;
  module: T | null;
  reload: () => void;
}

/**
 * Loads a lazily imported PDF module and exposes a bounded, self-healing
 * recovery path.
 *
 * A chunk-load failure (stale precache after a deploy) triggers exactly one
 * automatic recovery per session: stale service-worker assets are cleared and
 * the page reloads. There is no retry loop. Once the guard is set, later
 * failures settle on `error` and surface an actionable reload button instead.
 *
 * When storage is blocked the guard cannot persist, so recovery cannot be
 * bounded: the hook settles on `error` without reloading. If `reloadPage`
 * throws or the navigation never happens, it falls back to `error` after
 * `RELOAD_FALLBACK_MS`.
 *
 * `load` MUST be a stable module-level function; the effect is keyed on it.
 */
export function usePdfModule<T>(load: () => Promise<T>): PdfModuleState<T> {
  const [status, setStatus] = useState<PdfModuleStatus>('loading');
  const [module, setModule] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reloadFallback: ReturnType<typeof setTimeout> | undefined;
    const isCancelled = (): boolean => cancelled;

    const loadModule = async () => {
      try {
        const loaded = await load();
        if (isCancelled()) return;
        clearRecoveryAttempt();
        setModule(loaded);
        setStatus('ready');
      } catch (error) {
        if (isCancelled()) return;
        console.error('Failed to load PDF module:', error);
        const online =
          (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine !== false;
        if (isChunkLoadError(error) && online && !hasAttemptedRecovery() && markRecoveryAttempted()) {
          await clearStaleAssets();
          if (isCancelled()) return;
          try {
            reloadPage();
          } catch {
            setStatus('error');
            return;
          }
          reloadFallback = setTimeout(() => {
            if (!isCancelled()) setStatus('error');
          }, RELOAD_FALLBACK_MS);
          return;
        }
        setStatus('error');
      }
    };

    void loadModule();

    return () => {
      cancelled = true;
      if (reloadFallback !== undefined) clearTimeout(reloadFallback);
    };
  }, [load]);

  const reload = useCallback(() => {
    void clearStaleAssets().finally(reloadPage);
  }, []);

  return { status, module, reload };
}
