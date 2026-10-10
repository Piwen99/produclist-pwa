import { useMemo, useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { useAuth } from './auth/useAuth';
import { createE2eAuth } from './auth/testing/fakeAuth';
import { createSupabaseAuth } from './auth/supabaseAuth';
import { e2eBypassEnabled } from './auth/e2eBypass';
import { createSupabaseClient, readSupabaseConfig } from './data/supabase/client';
import { createE2eRepositories } from './data/testing/stub';
import { createSupabaseRepositories } from './data/supabase/repositories';
import { DataProvider } from './data/DataProvider';
import type { Repositories } from './data/ports';
import type { AuthPort } from './auth/ports';
import App from './App';

/**
 * The auth port plus a factory for the repository set. Both are resolved once
 * per page load so the underlying Supabase client is a single shared instance.
 */
interface Wiring {
  auth: AuthPort;
  /**
   * Builds the repository set for the authenticated user.
   *
   * The `userId` argument is consumed asymmetrically. The e2e stub scopes all
   * data by `userId`; the Supabase adapters ignore it and scope by RLS
   * (`auth.uid()`) instead. The parameter stays on the contract so both wiring
   * modes share one factory shape.
   */
  createRepositories: (userId: string) => Repositories;
}

function resolveWiring(): Wiring | null {
  if (e2eBypassEnabled(import.meta.env)) {
    return {
      auth: createE2eAuth(),
      createRepositories: (userId) => createE2eRepositories({ userId, isAdmin: false }),
    };
  }
  if (!readSupabaseConfig()) {
    return null;
  }
  // One client for the whole session. Building a second client for the data
  // layer spawns another GoTrueClient on the same storage key, which fires auth
  // events back into the gate and re-creates repositories in a tight loop
  // (the "Multiple GoTrueClient instances" storm that stalls the first load).
  const client = createSupabaseClient();
  return {
    auth: createSupabaseAuth(client),
    createRepositories: () => createSupabaseRepositories(client),
  };
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <span className="text-sm text-gray-500 dark:text-gray-400">Cargando…</span>
    </div>
  );
}

export function ConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-sm text-center space-y-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Aplicación no configurada
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Falta la configuración de Supabase. Contacta al administrador para habilitar el acceso.
        </p>
      </div>
    </div>
  );
}

interface AuthGateProps {
  createRepositories: Wiring['createRepositories'];
}

function AuthGate({ createRepositories }: AuthGateProps) {
  const { status, session } = useAuth();
  const userId = session?.userId ?? null;
  // Key the memo on the stable user id, not the session object: a token refresh
  // hands us a fresh object with the same id and must not rebuild repositories.
  const repositories = useMemo(
    () => (status === 'authenticated' && userId ? createRepositories(userId) : null),
    [status, userId, createRepositories],
  );

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated' || !userId || !repositories) return <LoginScreen />;

  return (
    <DataProvider repos={repositories} userId={userId}>
      <App />
    </DataProvider>
  );
}

export default function Root() {
  const [wiring] = useState(resolveWiring);

  if (!wiring) {
    return <ConfigErrorScreen />;
  }

  return (
    <AuthProvider auth={wiring.auth}>
      <AuthGate createRepositories={wiring.createRepositories} />
    </AuthProvider>
  );
}
