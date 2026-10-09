/**
 * Whether the e2e bypass is active. The e2e bypass is active ONLY outside
 * production: a production build must ignore `VITE_E2E` even when it is set, so
 * the stub auth and stub repositories can never ship as a live bypass.
 *
 * Kept out of `Root.tsx` so the composition root keeps exporting components
 * only (react-refresh) and this guard stays a plain, directly testable
 * predicate.
 */
export function e2eBypassEnabled(env: { VITE_E2E?: string; PROD?: boolean }): boolean {
  return env.VITE_E2E === '1' && !env.PROD;
}
