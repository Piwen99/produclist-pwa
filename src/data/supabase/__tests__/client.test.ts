import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseConfigError,
  assertSupabaseConfig,
  createSupabaseClient,
  readSupabaseConfig,
} from '../client';

const FULL_ENV = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_key',
};

describe('readSupabaseConfig', () => {
  it('returns url and anon key when both are present', () => {
    expect(readSupabaseConfig(FULL_ENV)).toEqual({
      url: FULL_ENV.VITE_SUPABASE_URL,
      anonKey: FULL_ENV.VITE_SUPABASE_ANON_KEY,
    });
  });

  it('returns null when the url is missing', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_ANON_KEY: 'key' })).toBeNull();
  });

  it('returns null when the anon key is missing', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull();
  });

  it('treats empty strings as missing', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }),
    ).toBeNull();
  });
});

describe('assertSupabaseConfig', () => {
  it('returns the config when present', () => {
    expect(assertSupabaseConfig(FULL_ENV)).toEqual({
      url: FULL_ENV.VITE_SUPABASE_URL,
      anonKey: FULL_ENV.VITE_SUPABASE_ANON_KEY,
    });
  });

  it('throws SupabaseConfigError when the config is missing', () => {
    expect(() => assertSupabaseConfig({})).toThrow(SupabaseConfigError);
  });
});

describe('createSupabaseClient', () => {
  it('builds a client from env through the injected factory', () => {
    const client = {} as SupabaseClient;
    const factory = vi.fn(() => client);

    const result = createSupabaseClient(FULL_ENV, factory);

    expect(factory).toHaveBeenCalledWith(
      FULL_ENV.VITE_SUPABASE_URL,
      FULL_ENV.VITE_SUPABASE_ANON_KEY,
    );
    expect(result).toBe(client);
  });

  it('surfaces the configuration error path when env is missing', () => {
    expect(() => createSupabaseClient({})).toThrow(SupabaseConfigError);
  });

  it('constructs a real client through the default factory', () => {
    const client = createSupabaseClient(FULL_ENV);
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.from).toBe('function');
  });
});
