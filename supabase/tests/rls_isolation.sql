-- RLS isolation against a real Postgres (issue #92).
--
-- Runs after `supabase db reset` on the local stack, as the `postgres`
-- superuser, with `psql -v ON_ERROR_STOP=1`. Every case lives in one
-- transaction that is rolled back, so the local database is left untouched.
--
-- Users are simulated the way PostgREST does it: switch to the `authenticated`
-- role and set the `request.jwt.claims` GUC that `auth.uid()` reads. No GoTrue
-- service and no login are involved.
--
-- The boundary under test is the one the app depends on: every row belongs to
-- one owner, an admin no longer reads other vendors' documents, and `anon`
-- holds no privileges on the data tables.

begin;

-- ── Fixtures: two vendors and one admin ────────────────────────────────────
-- The on_auth_user_created trigger provisions a `perfiles` row per user.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'vendor-a@test.local', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'vendor-b@test.local', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'admin@test.local', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.perfiles set rol = 'admin'
 where id = '00000000-0000-4000-8000-00000000000c';

insert into public.productos (nombre, categoria, formato, precio_neto, owner_id) values
  ('Producto A', 'Frutos Secos', '1', 1000, '00000000-0000-4000-8000-00000000000a'),
  ('Producto B', 'Frutos Secos', '1', 2000, '00000000-0000-4000-8000-00000000000b'),
  ('Producto Admin', 'Frutos Secos', '1', 3000, '00000000-0000-4000-8000-00000000000c');

insert into public.cotizaciones (cliente, items, total_neto, iva, total, owner_id) values
  ('Cliente A', '[]'::jsonb, 100, 19, 119, '00000000-0000-4000-8000-00000000000a'),
  ('Cliente B', '[]'::jsonb, 200, 38, 238, '00000000-0000-4000-8000-00000000000b'),
  ('Cliente Admin', '[]'::jsonb, 300, 57, 357, '00000000-0000-4000-8000-00000000000c');

insert into public.listas_enviadas (cliente, items, owner_id) values
  ('Cliente A', '[]'::jsonb, '00000000-0000-4000-8000-00000000000a'),
  ('Cliente B', '[]'::jsonb, '00000000-0000-4000-8000-00000000000b'),
  ('Cliente Admin', '[]'::jsonb, '00000000-0000-4000-8000-00000000000c');

-- ── Vendor A: sees its own rows only, and cannot write another owner's ─────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

do $$
declare visible integer;
begin
  select count(*) into visible from public.productos;
  if visible <> 1 then
    raise exception 'vendor A reads % producto rows, expected 1', visible;
  end if;

  select count(*) into visible from public.cotizaciones;
  if visible <> 1 then
    raise exception 'vendor A reads % cotizacion rows, expected 1', visible;
  end if;

  select count(*) into visible from public.listas_enviadas;
  if visible <> 1 then
    raise exception 'vendor A reads % lista_enviada rows, expected 1', visible;
  end if;

  select count(*) into visible from public.productos
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  if visible <> 0 then
    raise exception 'vendor A reads vendor B productos';
  end if;

  select count(*) into visible from public.cotizaciones
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  if visible <> 0 then
    raise exception 'vendor A reads vendor B cotizaciones';
  end if;

  select count(*) into visible from public.listas_enviadas
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  if visible <> 0 then
    raise exception 'vendor A reads vendor B listas_enviadas';
  end if;

  -- Only its own profile: perfiles is cross-readable for the admin, not peers.
  select count(*) into visible from public.perfiles;
  if visible <> 1 then
    raise exception 'vendor A reads % perfiles, expected 1', visible;
  end if;
end $$;

do $$
declare touched integer;
begin
  update public.productos set precio_neto = 1
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A updated % foreign producto rows', touched;
  end if;

  update public.cotizaciones set total = 1
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A updated % foreign cotizacion rows', touched;
  end if;

  update public.listas_enviadas set cliente = 'hack'
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A updated % foreign lista_enviada rows', touched;
  end if;

  delete from public.productos
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A deleted % foreign producto rows', touched;
  end if;

  delete from public.cotizaciones
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A deleted % foreign cotizacion rows', touched;
  end if;

  delete from public.listas_enviadas
   where owner_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'vendor A deleted % foreign lista_enviada rows', touched;
  end if;
end $$;

-- ── Vendor B: the same boundary in the other direction ─────────────────────
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

do $$
declare visible integer;
begin
  select count(*) into visible from public.productos;
  if visible <> 1 then
    raise exception 'vendor B reads % producto rows, expected 1', visible;
  end if;

  select count(*) into visible from public.cotizaciones;
  if visible <> 1 then
    raise exception 'vendor B reads % cotizacion rows, expected 1', visible;
  end if;

  select count(*) into visible from public.listas_enviadas;
  if visible <> 1 then
    raise exception 'vendor B reads % lista_enviada rows, expected 1', visible;
  end if;
end $$;

-- ── Admin: no cross-vendor read on the data tables, profiles still visible ──
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}',
  true
);

do $$
declare visible integer;
begin
  select count(*) into visible from public.productos;
  if visible <> 1 then
    raise exception 'admin reads % producto rows, expected only its own', visible;
  end if;

  select count(*) into visible from public.cotizaciones;
  if visible <> 1 then
    raise exception 'admin reads % cotizacion rows, expected only its own', visible;
  end if;

  select count(*) into visible from public.listas_enviadas;
  if visible <> 1 then
    raise exception 'admin reads % lista_enviada rows, expected only its own', visible;
  end if;

  -- The cross-vendor read that stays on purpose: profile provisioning.
  select count(*) into visible from public.perfiles;
  if visible <> 3 then
    raise exception 'admin reads % perfiles, expected 3', visible;
  end if;
end $$;

-- ── anon: no privileges on the data tables ─────────────────────────────────
reset role;
set local role anon;

do $$
begin
  if has_table_privilege('anon', 'public.productos', 'select') then
    raise exception 'anon holds select on public.productos';
  end if;
  if has_table_privilege('anon', 'public.cotizaciones', 'select') then
    raise exception 'anon holds select on public.cotizaciones';
  end if;
  if has_table_privilege('anon', 'public.listas_enviadas', 'select') then
    raise exception 'anon holds select on public.listas_enviadas';
  end if;

  if has_table_privilege('anon', 'public.productos', 'insert') then
    raise exception 'anon holds insert on public.productos';
  end if;
  if has_table_privilege('anon', 'public.cotizaciones', 'insert') then
    raise exception 'anon holds insert on public.cotizaciones';
  end if;
  if has_table_privilege('anon', 'public.listas_enviadas', 'insert') then
    raise exception 'anon holds insert on public.listas_enviadas';
  end if;

  if has_table_privilege('anon', 'public.productos', 'update') then
    raise exception 'anon holds update on public.productos';
  end if;
  if has_table_privilege('anon', 'public.cotizaciones', 'update') then
    raise exception 'anon holds update on public.cotizaciones';
  end if;
  if has_table_privilege('anon', 'public.listas_enviadas', 'update') then
    raise exception 'anon holds update on public.listas_enviadas';
  end if;

  if has_table_privilege('anon', 'public.productos', 'delete') then
    raise exception 'anon holds delete on public.productos';
  end if;
  if has_table_privilege('anon', 'public.cotizaciones', 'delete') then
    raise exception 'anon holds delete on public.cotizaciones';
  end if;
  if has_table_privilege('anon', 'public.listas_enviadas', 'delete') then
    raise exception 'anon holds delete on public.listas_enviadas';
  end if;

  -- TRUNCATE is not subject to RLS, so the grant itself has to be absent.
  if has_table_privilege('anon', 'public.productos', 'truncate') then
    raise exception 'anon holds truncate on public.productos';
  end if;
  if has_table_privilege('anon', 'public.cotizaciones', 'truncate') then
    raise exception 'anon holds truncate on public.cotizaciones';
  end if;
  if has_table_privilege('anon', 'public.listas_enviadas', 'truncate') then
    raise exception 'anon holds truncate on public.listas_enviadas';
  end if;
end $$;

rollback;
