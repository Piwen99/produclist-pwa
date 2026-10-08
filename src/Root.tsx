import { useMemo, useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { useAuth } from './auth/useAuth';
import { createE2eAuth } from './auth/testing/fakeAuth';
import { createSupabaseAuth } from './auth/supabaseAuth';
import { createSupabaseClient, readSupabaseConfig } from './data/supabase/client';
import { createE2eRepositories } from './data/testing/stub';
import { createSupabaseRepositories } from './data/supabase/repositories';
import { DataProvider } from './data/DataProvider';
import type { Repositories } from './data/ports';
import type { AuthPort } from './auth/ports';
import App from './App';

function resolveAuthPort(): AuthPort | null {
  if (import.meta.env.VITE_E2E === '1') {
    return createE2eAuth();
  }
  if (!readSupabaseConfig()) {
    return null;
  }
  return createSupabaseAuth(createSupabaseClient());
}

function resolveRepositories(userId: string): Repositories {
  if (import.meta.env.VITE_E2E === '1') {
    return createE2eRepositories({ userId, isAdmin: false });
  }
  return createSupabaseRepositories(createSupabaseClient());
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

function AuthGate() {
  const { status, session } = useAuth();
  const repositories = useMemo(
    () => (status === 'authenticated' && session ? resolveRepositories(session.userId) : null),
    [status, session],
  );

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated' || !session || !repositories) return <LoginScreen />;

  return (
    <DataProvider repos={repositories} userId={session.userId}>
      <App />
    </DataProvider>
  );
}

export default function Root() {
  const [auth] = useState<AuthPort | null>(() => resolveAuthPort());

  if (!auth) {
    return <ConfigErrorScreen />;
  }

  return (
    <AuthProvider auth={auth}>
      <AuthGate />
    </AuthProvider>
  );
}
