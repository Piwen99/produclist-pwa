import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, AuthSession } from './ports';
import { reportAuthDiagnostic } from '../utils/diagnostics';

export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';
export const CURRENT_PASSWORD_MESSAGE = 'La contraseña actual no es correcta.';
export const WEAK_PASSWORD_MESSAGE =
  'La nueva contraseña es demasiado débil. Usa al menos 8 caracteres.';
export const SAME_PASSWORD_MESSAGE = 'La nueva contraseña debe ser distinta de la actual.';
export const REAUTHENTICATION_MESSAGE =
  'Por seguridad, volvé a iniciar sesión y volvé a intentar.';
export const PASSWORD_UPDATE_MESSAGE =
  'No se pudo actualizar la contraseña. Intenta de nuevo.';

/**
 * How long the password-change request may stay pending before the dialog gives
 * up. A hung fetch or a captive portal never settles, and every dismissal route
 * is blocked while the request is in flight (issue #88).
 */
export const PASSWORD_UPDATE_TIMEOUT_MS = 15_000;

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

function isInvalidCredentials(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')
  );
}

function isWeakPassword(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'weak_password' ||
    /weak password|password should be at least|password is too weak/i.test(error.message ?? '')
  );
}

function isSamePassword(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'same_password' ||
    /different from the old password/i.test(error.message ?? '')
  );
}

function isCurrentPasswordMismatch(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'current_password_mismatch' ||
    /current password/i.test(error.message ?? '')
  );
}

function isReauthenticationNeeded(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'reauthentication_needed' ||
    /reauthenticat/i.test(error.message ?? '')
  );
}

/**
 * A session that no longer exists cannot be repaired by retrying. GoTrue reports
 * it as a code on the response, and the client throws `AuthSessionMissingError`
 * before any request leaves the browser (issue #87).
 */
function isSessionInvalid(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === 'session_not_found' ||
    candidate.code === 'session_expired' ||
    candidate.name === 'AuthSessionMissingError'
  );
}

/**
 * Leave the gate to show the login screen. Best effort: if the sign-out itself
 * fails, the re-login message is still the actionable exit.
 */
async function signOutForReauthentication(client: AuthClient): Promise<void> {
  try {
    await client.auth.signOut();
  } catch {
    // The message is the fallback; nothing else to recover here.
  }
}

/**
 * Maps a thrown transport failure to a safe message. Provider-reported errors
 * come back in `{ error }` and keep their specific mapping.
 */
export type AttemptFailure = { ok: false; reason: 'transport' | 'session-invalid' };
type AttemptSuccess<T> = { ok: true; value: T };

/**
 * Run one provider call with a bounded wait.
 *
 * Settlement is decided once: a late resolution or rejection after the timeout
 * is ignored, so the success path never runs after the dialog gave up (#88).
 * The caller maps the failure; a missing session is reported separately because
 * it needs a sign-out, not the generic retry message (#87).
 */
async function attempt<T>(
  operation: () => Promise<T>,
): Promise<AttemptSuccess<T> | AttemptFailure> {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const settle = () => {
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
  };

  const asError = (error: unknown): Error =>
    error instanceof Error ? error : new Error('password update failed', { cause: error });

  try {
    const value = await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error('password update timed out');
        error.name = 'TimeoutError';
        reject(error);
      }, PASSWORD_UPDATE_TIMEOUT_MS);

      try {
        operation().then(
          (result) => {
            if (settled) return;
            settle();
            resolve(result);
          },
          (error: unknown) => {
            if (settled) return;
            settle();
            reject(asError(error));
          },
        );
      } catch (error) {
        if (settled) return;
        settle();
        reject(asError(error));
      }
    });

    return { ok: true, value };
  } catch (error) {
    if (isSessionInvalid(error)) return { ok: false, reason: 'session-invalid' };

    // The cause never reaches the user; a provider message can carry the
    // endpoint or the account email, so only the error class is recorded.
    reportAuthDiagnostic('auth-transport-failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false, reason: 'transport' };
  }
}

export type AuthClient = Pick<SupabaseClient, 'auth'>;

export function createSupabaseAuth(client: AuthClient): AuthPort {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return toAuthSession(data.session);
    },

    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(toAuthSession(session));
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (!error) return;
      if (isInvalidCredentials(error)) {
        throw new Error(INVALID_CREDENTIALS_MESSAGE);
      }
      throw new Error(error.message);
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async changePassword(currentPassword, newPassword) {
      // The provider validates `current_password` when "Secure password change"
      // is enabled. No separate sign-in: updateUser is authorized by the JWT.
      const outcome = await attempt(() =>
        client.auth.updateUser({
          current_password: currentPassword,
          password: newPassword,
        }),
      );

      if (!outcome.ok) {
        if (outcome.reason === 'session-invalid') {
          // Retrying with the same stale session cannot succeed: sign out so
          // the auth gate shows the login screen in one step (issue #87).
          await signOutForReauthentication(client);
          throw new Error(REAUTHENTICATION_MESSAGE);
        }
        // Already diagnosed; the user gets the safe retry message.
        throw new Error(PASSWORD_UPDATE_MESSAGE);
      }

      const { error } = outcome.value;
      if (!error) return;
      if (isSessionInvalid(error)) {
        // Retrying with the same stale session cannot succeed: sign out so the
        // auth gate shows the login screen in one step (issue #87).
        await signOutForReauthentication(client);
        throw new Error(REAUTHENTICATION_MESSAGE);
      }
      // Provider precedence: a wrong current password is the more specific
      // signal and must not sign the user out, even if the message also mentions
      // reauthentication.
      if (isCurrentPasswordMismatch(error) || isInvalidCredentials(error)) {
        throw new Error(CURRENT_PASSWORD_MESSAGE);
      }
      if (isWeakPassword(error)) throw new Error(WEAK_PASSWORD_MESSAGE);
      if (isSamePassword(error)) throw new Error(SAME_PASSWORD_MESSAGE);
      if (isReauthenticationNeeded(error)) {
        await signOutForReauthentication(client);
        throw new Error(REAUTHENTICATION_MESSAGE);
      }
      throw new Error(PASSWORD_UPDATE_MESSAGE);
    },
  };
}
