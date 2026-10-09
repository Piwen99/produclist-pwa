import { useCallback, useEffect, useState } from 'react';
import {
  clearRecoveryAttempt,
  clearStaleAssets,
  hasAttemptedRecovery,
  isChunkLoadError,
  markRecoveryAttempted,
  reloadPage,
} from './pdfModuleRecovery';

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
 * `load` MUST be a stable module-level function; the effect is keyed on it.
 */
export function usePdfModule<T>(load: () => Promise<T>): PdfModuleState<T> {
  const [status, setStatus] = useState<PdfModuleStatus>('loading');
  const [module, setModule] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        if (isChunkLoadError(error) && online && !hasAttemptedRecovery()) {
          markRecoveryAttempted();
          await clearStaleAssets();
          if (isCancelled()) return;
          reloadPage();
          return;
        }
        setStatus('error');
      }
    };

    void loadModule();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(() => {
    void clearStaleAssets().finally(reloadPage);
  }, []);

  return { status, module, reload };
}
