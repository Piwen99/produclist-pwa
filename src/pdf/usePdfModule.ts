import { useCallback, useEffect, useState } from 'react';
import {
  clearRecoveryAttempt,
  clearStaleAssets,
  hasAttemptedRecovery,
  isChunkLoadError,
  markRecoveryAttempted,
  reloadPage,
} from './pdfModuleRecovery';

/**
 * Bound on how long the hook keeps showing `loading` after requesting a reload.
 * A successful navigation discards this page long before the timer fires; if it
 * does fire, the reload was blocked or never navigated, so the hook settles on
 * `error` and offers the manual reload button instead of hanging on `loading`.
 */
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
 * When `sessionStorage` is blocked the guard cannot survive a reload, so
 * reloading would loop. In that case the hook recovers in place: it clears the
 * stale assets and retries the import exactly once, settling on `error` if the
 * retry also fails.
 *
 * If `reloadPage` throws or the navigation never happens, it falls back to
 * `error` after `RELOAD_FALLBACK_MS`.
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
        const canAttemptRecovery = isChunkLoadError(error) && online && !hasAttemptedRecovery();

        if (!canAttemptRecovery) {
          setStatus('error');
          return;
        }

        const guardPersisted = markRecoveryAttempted();
        await clearStaleAssets();
        if (isCancelled()) return;

        if (guardPersisted) {
          try {
            reloadPage();
          } catch (reloadError) {
            console.error('Failed to reload after PDF chunk error:', reloadError);
            setStatus('error');
            return;
          }
          reloadFallback = setTimeout(() => {
            if (!isCancelled()) setStatus('error');
          }, RELOAD_FALLBACK_MS);
          return;
        }

        // The guard cannot persist, so a reload would loop. Retry the import
        // once in place; the cleared assets make a fresh fetch possible.
        try {
          const reloaded = await load();
          if (isCancelled()) return;
          clearRecoveryAttempt();
          setModule(reloaded);
          setStatus('ready');
        } catch (retryError) {
          console.error('Failed to load PDF module after in-place recovery:', retryError);
          setStatus('error');
        }
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
