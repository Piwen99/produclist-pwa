import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthPort, AuthSession } from './ports';
import { AuthContext, type AuthStatus } from './useAuth';

interface AuthProviderProps {
  auth: AuthPort;
  children: ReactNode;
}

export function AuthProvider({ auth, children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let active = true;
    let eventApplied = false;

    const applySession = (next: AuthSession | null) => {
      if (!active) return;
      setSession(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    };

    const handleEvent = (next: AuthSession | null) => {
      eventApplied = true;
      applySession(next);
    };

    const unsubscribe = auth.onAuthStateChange(handleEvent);

    void auth
      .getSession()
      .then((next) => {
        if (!eventApplied) applySession(next);
      })
      .catch(() => {
        if (!eventApplied) applySession(null);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  const signIn = useCallback(
    (email: string, password: string) => auth.signIn(email, password),
    [auth],
  );

  const signOut = useCallback(() => auth.signOut(), [auth]);

  const value = useMemo(
    () => ({ status, session, signIn, signOut }),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
