-- Vendor data is private per user (S2 of odd/tasks/vendor-data-privacy.md).
--
-- Phase 1 granted the admin (perfiles.rol = 'admin') an additive, read-only
-- cross-vendor view through the `..._select_own_or_admin` policies on these
-- three tables. That rule was mis-scoped: the owner wanted an admin to be able
-- to read data that is NOT connected to the project yet — specifically the ACH
-- sales report — so the rule belongs to that future surface, not to every other
-- vendor's documents (products, quotes, sent lists).
--
-- After this migration each table is owner-only on read, matching the
-- owner-only UPDATE/DELETE policies created in the init migration. A side
-- effect worth stating: an unscoped `select` now returns only the caller's
-- rows, so a stray app-level `list()` call cannot leak another owner's data.
--
-- `public.is_admin()` and `perfiles_select_own_or_admin` are deliberately left
-- in place: the helper is the mechanism reserved for exposing the ACH data to
-- admins once it is wired into the project (see odd/tasks/ventas-ach-consulta.md,
-- S2, where the admin sees every client of the ACH report).
--
-- Re-running this file is safe: each block drops both the pre-migration
-- `..._select_own_or_admin` name and this migration's own `..._select_own`
-- name before creating the latter, so a second application is a no-op instead
-- of a "policy already exists" error.

-- ── productos ──────────────────────────────────────────────────────────────
drop policy if exists "productos_select_own_or_admin" on public.productos;
drop policy if exists "productos_select_own" on public.productos;
create policy "productos_select_own" on public.productos
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- ── cotizaciones ───────────────────────────────────────────────────────────
drop policy if exists "cotizaciones_select_own_or_admin" on public.cotizaciones;
drop policy if exists "cotizaciones_select_own" on public.cotizaciones;
create policy "cotizaciones_select_own" on public.cotizaciones
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- ── listas_enviadas ────────────────────────────────────────────────────────
drop policy if exists "listas_enviadas_select_own_or_admin" on public.listas_enviadas;
drop policy if exists "listas_enviadas_select_own" on public.listas_enviadas;
create policy "listas_enviadas_select_own" on public.listas_enviadas
  for select to authenticated
  using (owner_id = (select auth.uid()));
