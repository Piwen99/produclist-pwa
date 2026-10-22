/**
 * Diagnostics for auth failures that the app deliberately swallows.
 *
 * Web Storage can be blocked, exhausted or read-only, and the auth client
 * degrades to an in-memory session instead of crashing. That recovery used to
 * be invisible: production could not tell a healthy signed-out tab from one
 * running on the fallback (#86).
 *
 * This module is the single seam every swallowed failure reports through. It is
 * not auth-scoped by accident: any caller can route it to a real sink later
 * (Sentry, a Supabase table) without touching the storage layer.
 *
 * Never pass a token, an email or a provider message: those are secrets or can
 * carry one. A storage key name, a kind and an error class name are enough.
 */

export type AuthDiagnosticKind =
  | 'storage-read-failed'
  | 'storage-write-failed'
  | 'storage-remove-failed'
  | 'legacy-token-cleanup-failed'
  | 'auth-transport-failed';

export interface AuthDiagnosticContext {
  /** Storage key involved. Key names are not secrets. */
  key?: string;
  /** Stable, machine-readable reason: an error class name, never a message. */
  reason?: string;
}

/** Stable tag so a log search or a sink filter can key on it. */
export const AUTH_DIAGNOSTIC_TAG = '[auth]';

/**
 * Emit exactly one structured warning for a swallowed auth failure.
 * Call it once per failure, at the point the failure is recovered from.
 */
export function reportAuthDiagnostic(
  kind: AuthDiagnosticKind,
  context: AuthDiagnosticContext = {},
): void {
  console.warn(AUTH_DIAGNOSTIC_TAG, kind, context);
}
