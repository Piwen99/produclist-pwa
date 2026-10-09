-- Least privilege for public.perfiles — follow-up to 20261005000000_init.sql.
--
-- The init migration intended `authenticated` to hold ONLY `SELECT` on
-- public.perfiles, but the live project currently shows SELECT, INSERT, UPDATE
-- and DELETE for `authenticated`. Those extra write grants are inert under RLS
-- (perfiles has only a SELECT policy, so INSERT/UPDATE/DELETE never pass the
-- policy) but least privilege says they should not exist. Revoke them
-- explicitly — defensively from `anon` too — then re-grant only SELECT to
-- `authenticated`.
revoke insert, update, delete on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
