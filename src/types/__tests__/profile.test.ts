import { describe, it, expect } from 'vitest';
import type { Profile, ProfileRole } from '../profile';

describe('Profile', () => {
  it('accepts an admin profile', () => {
    const profile: Profile = {
      id: 'uuid-admin',
      email: 'admin@example.com',
      nombre: 'Admin Demo',
      rol: 'admin',
    };

    expect(profile.rol).toBe('admin');
    expect(profile.id).toBe('uuid-admin');
  });

  it('accepts a vendedor profile', () => {
    const rol: ProfileRole = 'vendedor';
    const profile: Profile = {
      id: 'uuid-vendor',
      email: 'vendedor1@example.com',
      nombre: 'Vendedor Demo',
      rol,
    };

    expect(profile.rol).toBe('vendedor');
  });
});
