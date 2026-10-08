export interface AuthSession {
  userId: string;
  email: string | null;
}

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>; // rejects with user-safe message
  signOut(): Promise<void>;
}
