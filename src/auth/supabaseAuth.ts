import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, AuthSession } from './ports';

export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';
export const CURRENT_PASSWORD_MESSAGE = 'La contraseña actual no es correcta.';
export const WEAK_PASSWORD_MESSAGE =
  'La nueva contraseña es demasiado débil. Usa al menos 8 caracteres.';
export const SAME_PASSWORD_MESSAGE = 'La nueva contraseña debe ser distinta de la actual.';
export const PASSWORD_UPDATE_MESSAGE =
  'No se pudo actualizar la contraseña. Intenta de nuevo.';

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
      // `updateUser` does not verify the current password, so re-authenticate
      // first: this both proves ownership and refreshes the session.
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(PASSWORD_UPDATE_MESSAGE);
      const email = data.session?.user.email;
      if (!email) throw new Error(PASSWORD_UPDATE_MESSAGE);

      const { error: verifyError } = await client.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        if (isInvalidCredentials(verifyError)) throw new Error(CURRENT_PASSWORD_MESSAGE);
        throw new Error(PASSWORD_UPDATE_MESSAGE);
      }

      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (!updateError) return;
      if (isWeakPassword(updateError)) throw new Error(WEAK_PASSWORD_MESSAGE);
      if (isSamePassword(updateError)) throw new Error(SAME_PASSWORD_MESSAGE);
      throw new Error(PASSWORD_UPDATE_MESSAGE);
    },
  };
}
