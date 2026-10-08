-- Phase 1 — Supabase migration (server-first, private per user).
-- Source of truth: openspec/changes/phase-1-supabase-migration/design.md
-- ("Schema / RLS / trigger" block, Decisions 1-4, 6, 8).
--
-- Model: every data row is private to one owner (owner_id) and only the owner
-- can write it; the admin (perfiles.rol = 'admin') gets an additive, read-only
-- global view through RLS. RLS is the single enforcement point.

-- ── Tables ────────────────────────────────────────────────────────────────
create table public.productos (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  categoria    text not null check (categoria in
                 ('Frutos Secos','Semillas/Cereal','Fruta Deshidratada','Legumbres')),
  formato      text not null default '' check (formato = '' or formato ~ '^\d+(,\d+)?$'),
  precio_neto  integer not null check (precio_neto >= 0),
  disponible   boolean not null default true,
  owner_id     uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now()
);
-- Per-user uniqueness: two vendors may legitimately own the same product name.
create unique index productos_owner_nombre_key on public.productos (owner_id, nombre);

create table public.cotizaciones (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  cliente    text,
  items      jsonb not null default '[]'::jsonb,
  total_neto integer not null,
  iva        integer not null,
  total      integer not null,
  owner_id   uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index cotizaciones_owner_fecha_idx on public.cotizaciones (owner_id, fecha desc);

create table public.listas_enviadas (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  cliente    text not null,
  items      jsonb not null default '[]'::jsonb,
  owner_id   uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index listas_enviadas_owner_fecha_idx on public.listas_enviadas (owner_id, fecha desc);

create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  nombre     text not null,
  rol        text not null default 'vendedor' check (rol in ('admin','vendedor')),
  created_at timestamptz not null default now()
);

-- ── Non-recursive admin check (Decision 3) ────────────────────────────────
-- perfiles' own SELECT policy calls is_admin(); if is_admin() read perfiles as
-- the invoker, that read would re-enter the perfiles policy and Postgres would
-- abort with 42P17 (infinite recursion in policy). SECURITY DEFINER + a pinned
-- empty search_path makes the inner read run as the function owner (the table
-- owner, exempt from its own RLS) and breaks the cycle. Fully-qualified names
-- prevent search_path hijacking of a definer function.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles where id = uid and rol = 'admin'
  );
$$;
revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- ── RLS: private rows, admin read-all, owner-only writes (Decision 2) ─────
alter table public.productos        enable row level security;
alter table public.cotizaciones     enable row level security;
alter table public.listas_enviadas  enable row level security;
alter table public.perfiles         enable row level security;

-- (select auth.uid()) evaluates once per statement (initplan) instead of per row.
create policy "productos_select_own_or_admin" on public.productos
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "productos_insert_own" on public.productos
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "productos_update_own" on public.productos
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "productos_delete_own" on public.productos
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "cotizaciones_select_own_or_admin" on public.cotizaciones
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "cotizaciones_insert_own" on public.cotizaciones
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "cotizaciones_update_own" on public.cotizaciones
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "cotizaciones_delete_own" on public.cotizaciones
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "listas_enviadas_select_own_or_admin" on public.listas_enviadas
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "listas_enviadas_insert_own" on public.listas_enviadas
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "listas_enviadas_update_own" on public.listas_enviadas
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "listas_enviadas_delete_own" on public.listas_enviadas
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "perfiles_select_own_or_admin" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin((select auth.uid())));

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated (confirmed empirically on the local stack), which contradicts
-- the design's "anon has no grants". Enforce least privilege explicitly: anon
-- gets nothing (RLS already denies it reads/writes, but TRUNCATE is NOT subject
-- to RLS); authenticated keeps only the DML the design names.
revoke all
  on public.productos, public.cotizaciones, public.listas_enviadas, public.perfiles
  from anon;
revoke truncate, references, trigger
  on public.productos, public.cotizaciones, public.listas_enviadas, public.perfiles
  from authenticated;
grant select, insert, update, delete
  on public.productos, public.cotizaciones, public.listas_enviadas to authenticated;
grant select on public.perfiles to authenticated;

-- ── Profile provisioning + role assignment (Decision 8) ───────────────────
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
          'vendedor');   -- role is NEVER taken from user metadata
  return new;
end; $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- After the 5 accounts exist (dashboard provisioning), one documented,
-- idempotent statement promotes the admin:
--   update public.perfiles set rol = 'admin' where email = 'admin@example.com';
