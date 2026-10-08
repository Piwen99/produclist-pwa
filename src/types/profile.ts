export type ProfileRole = 'admin' | 'vendedor';

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: ProfileRole;
}
