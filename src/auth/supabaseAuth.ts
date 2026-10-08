import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, AuthSession } from './ports';

export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

function isInvalidCredentials(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')
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
  };
}
