import { createClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export type SupabaseClientFactory = (url: string, anonKey: string) => ReturnType<typeof createClient>;

export class SupabaseConfigError extends Error {
  constructor(message = 'Falta la configuración de Supabase.') {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

export function readSupabaseConfig(env: SupabaseEnv = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function assertSupabaseConfig(env: SupabaseEnv = import.meta.env): SupabaseConfig {
  const config = readSupabaseConfig(env);
  if (!config) throw new SupabaseConfigError();
  return config;
}

export function createSupabaseClient(
  env: SupabaseEnv = import.meta.env,
  factory: SupabaseClientFactory = (url, anonKey) => createClient(url, anonKey),
): ReturnType<typeof createClient> {
  const { url, anonKey } = assertSupabaseConfig(env);
  return factory(url, anonKey);
}
