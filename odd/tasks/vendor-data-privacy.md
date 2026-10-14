# Feature: Vendor data is private per user (admin read-all reserved for the ACH data)

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/vendor-data-privacy/tasks`.
> Extends `odd/tasks/catalog-scope-and-pdf.md` (S1 already made the product catalog owner-scoped)
> to every other vendor-data surface, and moves the `is_admin()` read-all rule out of the
> Phase-1 tables so it lives only where the owner wants it: the not-yet-connected ACH data.

Branch: `fix/vendor-data-privacy` (from `master` @ `0ad0992`)
Delivery strategy: `ask-on-risk` — two deliverables: the app seam (deploys with the app) and the RLS migration (a separate, explicitly authorized database step)
Test runner: `pnpm test` (vitest; `pnpm exec vitest --run <paths>` for one shot)

## Specs

**S1 — Every vendor-data surface is owner-scoped.** The Historial (`cotizaciones`), Listas enviadas, Precios por cliente and the client-name suggestions MUST show only the session owner's rows, for every principal including an admin. Today all four read the RLS-visible set (`repos.quotes.list()` `src/components/QuoteHistory.tsx:145`, `repos.listSends.list()` `src/components/ListSends.tsx:37`, both at `src/components/ClientPrices.tsx:103-104`, and `repos.clients.listNames()`), which for an admin also returns every other owner's rows through the `..._select_own_or_admin` policies (`supabase/migrations/20261005000000_init.sql:86,95,104`).
- Acceptance: mounted for an admin whose repos expose 2 rows through `list()` and 1 through `listOwn()`, each surface renders only the owner-scoped row.
- Acceptance: every changed call site passes the session `userId` (`listOwn(userId)` / `listNames(userId)`), never the unscoped read.

**S2 — The admin read-all rule is reserved for the ACH data.** A new migration MUST drop the `is_admin()` clause from the SELECT policies of `public.productos`, `public.cotizaciones` and `public.listas_enviadas`, leaving owner-only policies. `public.is_admin()` and `perfiles_select_own_or_admin` MUST stay: the helper is the mechanism reserved for the ACH data the owner wants admins to read once it is exposed (see `odd/tasks/ventas-ach-consulta.md`, S2). Requirement (user's words, L1): *"No es necesario que el admin vea ni la lista ni las cotizaciones de todos los vendedores."*

**S3 — Client-name suggestions are owner-scoped.** `ClientsRepo.listNames` MUST take the owner id (`listNames(userId)`), and both the Supabase adapter and the in-memory fake MUST derive names only from that owner's quotes and list sends. A vendor MUST NOT be offered a client that only exists in another vendor's documents.

**S4 — No behavior change for a vendor, and no data loss for anyone.** For a non-admin principal the reads resolve to the same rows as today. Writes stay owner-only (`..._delete_own` / `..._update_own` are untouched), the ownership guard (`OwnershipError` on a filtered row) is untouched, and no row is deleted or migrated.

**S5 — The migration is a separate delivery step.** The migration file lives in the repo, but applying it to the live Supabase project is a distinct operation that needs the owner's explicit authorization (the parent never pushes to the remote project without it). The app-level S1/S3 changes ship with the app and take effect on deploy, independently of that step.
- Acceptance: with the migration unapplied, the four surfaces still show only the owner's rows (S1/S3 are not conditional on the database step). With it applied, a direct API read is owner-scoped too.

**S6 — The permissive test double is kept on purpose.** `src/data/testing/inMemoryRepos.ts` continues to model the pre-migration permissive RLS for `list()`, so any code path that leans on the platform's permissiveness shows foreign rows in tests (a leak detector). Its docstring MUST say so, and `listNames(userId)` MUST be owner-scoped there as well.

Out of scope: removing the now-unused `list()` port methods (they are harmless once RLS is owner-only; a cleanup candidate, not this change); any change to `perfiles`, quotes/list-sends data, or the ACH feature itself.

## Tasks

| ID | Spec | Route | Status | Evidence |
|----|------|-------|--------|----------|
| T1 | S1 | delegated (writer) | done | RED 5 failing (foreign rows/cards rendered by the four surfaces) → GREEN; parent spot check re-ran the full suite |
| T2 | S3 | delegated (writer) | done | `listNames(userId)` in port, adapter (`.eq('owner_id', …)` on both selects), fake; callers updated |
| T3 | S2, S5 | inline (parent) | done | `supabase/migrations/20261014000000_vendor_data_private.sql`; live application still pending authorization |
| T4 | S6 | delegated (writer) | done | fake docstring states the leak-detector role; fake `listNames` reads `listOwn` only |
| T5 | S4 | inline | done | `pnpm exec vitest --run` 557/557 (59 files) · `pnpm lint` clean · `pnpm exec tsc -b` clean |
| T6 | — | delegated (verify) | pending | independent read-only verification (permissions change) |
| T7 | — | RDD | pending | `gentle-ai review assess` on the candidate |

## Log

**L1 (user, verbatim, 2026-10-14):** *"Sobre que el admin lea todo, fue mi error al momento de pedirtelo y no explciarte. Yo queria que los usuarios admin pudiesen ver y leer información que aun no esta conectada al proyecto, en especifico informacion del reporte de ventas ACH, para cuando sepamos como "agregar" o exponer esa informacion en el proyecto dejemos alli si es relevante esa "regla". No es necesario que el admin vea ni la lista ni las cotizaciones de todos los vendedores."*

**L2 — Product decision (user).** Asked how far to take per-vendor privacy, the owner chose **all vendor data private**: products, quotes, sent lists, per-client price history and client names. The conversation ran in Spanish; technical artifacts stay English.

**L3 — Evidence of the exposure (pre-change).** Four surfaces read the RLS-visible set: `QuoteHistory.tsx:145`, `ListSends.tsx:37`, `ClientPrices.tsx:103-104`, and `clients.listNames()` (`src/data/supabase/clientsRepo.ts:39-50`, both source tables unfiltered). An admin therefore saw every vendor's quote history, sent lists, per-client price history and client names — not just the catalog fixed in `catalog-scope-and-pdf.md`.

**L4 — Design reversal recorded.** The Phase-1 proposal listed "the commercial lead's global view" as a value, and `design.md` Decision 2 accepted the admin read-all as the supervision view. The owner now scopes that value to the ACH data: supervision of *sales*, not of vendor documents. The openspec artifacts stay as the Phase-1 record (already marked STALE by `phase-1-supabase-migration.md`); this document is the live rule.

**L5 — Why both layers.** The RLS migration is the enforcement point (single source of truth, and it neutralizes any future `list()` call), but it needs a manual step on the live project. The app seam (`listOwn(userId)` / `listNames(userId)`) makes every surface correct as soon as the app deploys, and it pins the intent in tests. Neither layer alone would satisfy S5's acceptance.

**L6 — Implementation evidence (T1/T2/T4).** One bounded writer unit (delegated; parent reviewed the diff and kept git). RED observed with the permissive double: 5 tests failing across `QuoteHistory.test.tsx`, `ListSends.test.tsx`, `ClientPrices.test.tsx`, `inMemoryRepos.test.ts`, `clientsRepo.test.ts` — the four surfaces rendered the foreign row/card/client, and `listNames` returned the union. Fields touched: `QuoteHistory.tsx`/`ListSends.tsx`/`ClientPrices.tsx`/`Cotizador.tsx`/`App.tsx` (owner-scoped reads + `userId` in the effect deps), `ports.ts` (`listNames(userId)`; the three `list()` docstrings now state they are the RLS-visible reads, owner-only once this migration lands, unused by the app), `clientsRepo.ts` (`ClientsQuery.eq` + both selects filtered), `inMemoryRepos.ts` (the clients fake derives names from `listOwn` only; the S6 leak-detector note). GREEN: the 5 focused files 77/77; the writer also adapted 7 pre-existing tests that stubbed/spied `list()` instead of `listOwn()` (no assertion weakened), and rewrote the cases that pinned the old cross-vendor contract (`QuoteHistory`/`ListSends` admin cases → own-rows-only; `inMemoryRepos` client-name case → owner-scoped by signature; `clientsRepo` union case → renamed merge test plus a new `.eq('owner_id', …)` assertion). Parent spot check: `pnpm exec vitest --run` 557/557 across 59 files, `pnpm lint` and `pnpm exec tsc -b` clean.

**L7 — The migration (T3), and its delivery gate.** `supabase/migrations/20261014000000_vendor_data_private.sql` drops the `is_admin()` clause from the SELECT policies of `productos`, `cotizaciones` and `listas_enviadas` and recreates them owner-only (`drop policy if exists` + `create policy`, safe to re-run); it leaves `is_admin()` and `perfiles_select_own_or_admin` in place for the reserved ACH exposure. There is no runnable RED for it: the repo has no SQL/pgTAP local harness (only `supabase/migrations/` and `config.toml`), so the structural check is a careful read plus review, and the functional proof arrives when it is applied to a live database. Applying it is a separate operation that requires the owner's explicit authorization; the app-layer change already delivers S1/S3 without it.
