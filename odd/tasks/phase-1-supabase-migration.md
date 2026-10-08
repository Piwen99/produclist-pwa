# Feature: Phase 1 — Supabase Migration (Server-First, Private Per User)

> ODD feature document. Single topic: this file. Source of intent and design lives
> in `openspec/changes/phase-1-supabase-migration/proposal.md` and `design.md`
> (retired SDD artifacts, treated as reference). The four
> `openspec/changes/phase-1-supabase-migration/specs/*/spec.md` files are **STALE**
> (old shared-catalog model) and were deliberately not used to derive tasks.

## Objective

Move `produclist` from local-first Dexie/IndexedDB to Supabase (Postgres + Auth +
RLS), server-first, with `productos`, `cotizaciones` (+ items) and
`listas_enviadas` (+ items) **private per user**, owner-or-admin reads, owner-only
writes, and the UI unchanged apart from four accepted deltas. Each salesperson
keeps their own list and prices; the admin gets a read-only global view.

## Problem

Data is an island per device: a lost or replaced phone loses products, quotes and
"last price sent to each client". There is no cloud persistence, no multi-device
access, and the commercial lead has no global view. Today's v2 export writes only
`products` + `quotes` (`src/utils/exportImport.ts:15,21-26`) and drops `listSends`,
so migrating on v2 would permanently destroy the list-send half of client price
history.

## Why (motivation and value)

Cloud persistence + multi-device + no data loss on device loss + the commercial
lead's global view. The value is **not** vendor-to-vendor collaboration. Phase 1 is
a data-layer migration, not a product redesign.

## Scope

### In scope

1. Supabase project (region `southamerica-east1`, São Paulo) + Postgres schema:
   `productos`, `cotizaciones`, `listas_enviadas`, `perfiles` — all with `owner_id`;
   `perfiles.rol` (`'admin' | 'vendedor'`).
2. Email/password Auth for 5 dashboard-provisioned `example.com` accounts,
   self-signup disabled: `admin@` (admin); `vendedor1@`, `vendedor2@`, `vendedor3@`,
   `vendedor4@` (vendedores).
3. RLS: `SELECT = owner_id = auth.uid() OR is_admin(auth.uid())`; writes require
   `owner_id = auth.uid()`; `owner_id NOT NULL DEFAULT auth.uid()`.
4. Product-name uniqueness `(owner_id, nombre)`; per-user 44-product seed.
5. Export/import v3 (adds `listSends`) + per-device real-data migration (each user
   imports their own v3 backup as `owner_id = self`).
6. Retire Dexie behind typed repository ports + Supabase adapters.
7. Accepted UI deltas only: login screen, "Cerrar sesión" item, import-confirmation
   copy, `BackupReminder` retirement.
8. IDs stay numeric (Postgres `bigint identity`).
9. Keep existing CI (`verify` + `e2e`) green.

### Out of scope

- Shared catalog or any cross-vendor collaboration/editing.
- Cross-user edit conflicts / optimistic locking — impossible with one writer per
  private row; dropped entirely.
- ACH sales-report ingestion; Metabase or any reporting integration.
- Any new product feature beyond the migration and the four accepted UI deltas.
- Offline UX: server-first removes offline capability; **accepted trade-off**, no
  offline banner/cache/write queue. Revisit only on reported pain.
- No Supabase Realtime in Phase 1.
- `openspec/specs/` is empty: no capability modifications, only new behavior.

## Constraints

- **Hard ordering**: v3 export/import ships FIRST against the current Dexie app (v2
  drops `listSends`); then schema + auth + RLS; then repository adapter swap; then
  per-device real-data migration; then CI hardening. v3 is a hard gate on migration.
- **UI freeze**: no UI change beyond the four accepted deltas.
- **Tests**: Strict TDD is ON. The only unit/coverage command is `pnpm coverage`
  (NEVER `pnpm test`); also `pnpm lint`, `pnpm exec tsc -b`, `pnpm exec playwright test`
  (e2e). Coverage thresholds 60/55/60/60.
- **Delivery budget**: `auto-chain` feature-branch chain. The 400-line budget is an
  advisory planning heuristic per task; the real delivery budget reads the
  accumulated branch. One deliverable work unit per PR where possible; tests and
  docs stay with the unit they verify.
- **Security**: RLS is the single enforcement point. `is_admin()` must be a
  non-recursive `SECURITY DEFINER` helper; do not enable `FORCE ROW LEVEL SECURITY`
  on `perfiles`. Uniqueness match is exact. Application reads add no client-side
  owner filter (RLS-visible set *is* the result).
- **Infra**: Vercel auto-deploys on merge to `master`; `master` is protected (all
  work via PR). Supabase Free tier = dev/migration only; gate to Pro before real
  salespeople use it (owner: Piwen).
- **Migration**: per device, no canonical run, no cross-user conflict handling.
- **Secrets**: the anon/publishable key is public by design; the service-role key is
  never used by the app or committed.

## Authorized scope

Implementers may only touch the surfaces named below (from the design's Affected
Areas). Anything else is out of budget and must be raised.

- `src/utils/exportImport.ts`; `src/utils/__tests__/exportImport.test.ts`
- `supabase/config.toml`; `supabase/migrations/*.sql`
- `package.json`, `pnpm-lock.yaml`, `src/vite-env.d.ts`, `vitest.config.ts`,
  `playwright.config.ts`, `.github/workflows/ci.yml`, `README.md`
- `src/data/**` (ports, supabase adapters, local, testing, seedProducts, cache, provider)
- `src/auth/**`, `src/Root.tsx`, `src/main.tsx`, `src/App.tsx`
- `src/hooks/useProducts.ts`, `useAddProduct.ts`, `useUpdateProduct.ts`,
  `useDeleteProduct.ts`, `useQuote.ts` and their tests
- `src/components/QuoteHistory.tsx`, `ClientPrices.tsx`, `Cotizador.tsx`,
  `QuoteProductSelector.tsx`, `PDFButton.tsx`; `src/pdf/ProductPDFDocument.tsx`
- `src/types/product.ts`, `src/types/quote.ts`, `src/types/listSend.ts`,
  `src/types/profile.ts`
- `src/db/database.ts`, `src/db/seed.ts`, `src/db/__tests__/*` (deletions, T11)
- `src/utils/clientNames.ts`, `src/utils/clientTracking.ts`
- `src/components/BackupReminder.tsx`, `src/utils/backupReminder.ts` + tests (deletion, T11)
- `src/test-setup.ts`; `e2e/*.spec.ts`
- Unchanged by design: `src/utils/clientTracking.ts` logic, `src/utils/listSend.ts`.

Authoring artifact edit surface for this document: `odd/tasks/phase-1-supabase-migration.md`.

## Actionable checklist

Each task is one reviewable work unit. Each carries: deliverable, acceptance
criteria, applicable checks, route (inline vs delegated) + trigger evidence, and an
advisory changed-line forecast used for PR slicing. Stable IDs must never be
renumbered.

### T1 — Export/import v3 with `listSends` + list-send signature (Dexie-era)

- **Delivers**: `BACKUP_VERSION = 3`; `BackupFile.listSends`; `exportBackup` reads
  `listSends`; `parseProductImport` accepts absent `listSends` (v1/v2 → `[]`);
  `ImportPreview.listSendsToAdd`; `ImportResult.listSendsAdded`;
  `listSendSignature()` = JSON of `{ fecha: ISO, cliente: trimmed+lowercased,
  items: [{nombre, formato, precioNeto, precioBruto}] }`; `applyImport` merges list
  sends by signature.
- **Acceptance**: v3 round-trips `products` + `quotes` + `listSends`; v1 bare array
  and v2 files still import unchanged; re-importing the same v3 file is a no-op;
  list-send signature merge adds only unseen sends.
- **Checks**: `pnpm coverage` (new v3 cases authored first), `pnpm lint`,
  `pnpm exec tsc -b`.
- **Route**: planned inline; **executed delegated** (writer trigger: 2 non-trivial
  files). The ODD writer trigger fired on the two non-trivial edit surfaces
  (`exportImport.ts` + its test file), so T1 ran as a delegated bounded writer
  instead of inline. Trigger: one shared format file whose preview/apply contract
  downstream slices (T6, T10) depend on; a single author must hold it.
- **Forecast**: ~180–260 authored lines incl. tests.

### T2 — Import/summary copy reports list-send counts (Dexie-era)

- **Delivers**: App.tsx import confirmation/summary copy includes list-send counts
  (`listSendsToAdd` / `listSendsAdded`). Accepted UI delta.
- **Acceptance**: confirmation copy reports list sends; no other copy or markup
  change; existing flows unaffected.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`, `pnpm exec playwright test`.
- **Route**: inline. Trigger: tiny copy delta shipping in the same PR as T1; no
  independent interface.
- **Forecast**: ~20–40 authored lines.

### T3 — Postgres schema, RLS, `is_admin()`, provisioning trigger, CLI config

- **Delivers**: `supabase/config.toml`; `supabase/migrations/20261005000000_init.sql`
  with tables `productos` / `cotizaciones` / `listas_enviadas` / `perfiles`;
  `owner_id uuid not null default auth.uid() references auth.users(id)`;
  `perfiles.rol` check `('admin','vendedor')`; unique index `(owner_id, nombre)`;
  `(owner_id, fecha desc)` indexes; `is_admin()` `SECURITY DEFINER` `stable`
  `set search_path = ''` with `revoke ... from public, anon` + grant to
  `authenticated`; RLS enabled + `select_own_or_admin` / `insert_own` / `update_own`
  / `delete_own` policies on the three data tables; `perfiles_select_own_or_admin`;
  grants (`select,insert,update,delete` on data tables, `select` on `perfiles`);
  `handle_new_user` trigger inserting `rol = 'vendedor'` (never from metadata).
- **Acceptance**: migration applies cleanly to the dev project; anon denied; no
  `42P17` recursion; RLS probe passes (vendor A sees only own rows, update of vendor
  B row affects 0 rows; admin `is_admin()` true and reads all owners); `owner_id`
  populated from first insert; admin promotion `UPDATE` is idempotent.
- **Checks**: manual migration apply + RLS probe + integration checklist on the dev
  project (no CI credentials — Decision 14). Regression: `pnpm lint`,
  `pnpm exec tsc -b`, `pnpm coverage`, `pnpm exec playwright test` stay green.
- **Route**: inline. Trigger: security boundary and cross-slice schema contract
  (owner default, `is_admin`, uniqueness) every adapter depends on; needs design
  sign-off.
- **Forecast**: ~180–260 SQL/config lines.

### T4 — Supabase client, env typing, auth port + adapter

- **Delivers**: add `@supabase/supabase-js`; `src/vite-env.d.ts` (`VITE_SUPABASE_URL?`,
  `VITE_SUPABASE_ANON_KEY?`, `VITE_E2E?`); `src/data/supabase/client.ts` (env read,
  `createClient`, `assertSupabaseConfig`); `src/auth/ports.ts` (`AuthPort`,
  `AuthSession`); `src/auth/supabaseAuth.ts` (`signInWithPassword` / `getSession` /
  `onAuthStateChange` incl. `INITIAL_SESSION` / `signOut`); `src/types/profile.ts`.
- **Acceptance**: client constructs from env; missing config surfaces the
  configuration-error path; adapter maps invalid credentials to a user-safe message;
  unit-tested against a stub client with no network.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`.
- **Route**: delegated. Trigger: self-contained adapter behind a frozen `AuthPort`;
  no UI or composition decisions; fully stub-testable.
- **Forecast**: ~150–220 authored lines incl. tests.

### T5 — Auth provider, login screen, composition root, logout, e2e gate

- **Delivers**: `src/auth/AuthProvider.tsx` + `useAuth.ts` (status state machine);
  `src/auth/LoginScreen.tsx` (email/password, Spanish copy, generic
  invalid-credentials error); `src/auth/testing/fakeAuth.ts`;
  `src/Root.tsx`; `src/main.tsx` boots the service container; `src/App.tsx`
  "Cerrar sesión" in the existing hamburger menu; `playwright.config.ts`
  `webServer.env: { VITE_E2E: '1' }`; `e2e/auth.spec.ts`.
- **Acceptance**: unauthenticated shows login; sign-in reveals the app; sign-out
  returns to login; `VITE_E2E=1` authenticates by default and
  `localStorage['e2e:auth']='off'` asserts the gate; missing config without
  `VITE_E2E=1` renders the config-error screen; no other UI change.
- **Checks**: `pnpm coverage` (gate states + login success/error + sign-out with
  fake `AuthPort`), `pnpm lint`, `pnpm exec tsc -b`, `pnpm exec playwright test`.
- **Route**: planned inline; **executed delegated** (writer trigger: 10
  new/modified non-trivial files spanning the auth gate, composition root, hooks,
  tests and e2e).
- **Forecast**: ~220–320 authored lines incl. tests + e2e.

### T6 — Repository ports + Supabase products adapter + mappers/errors

- **Delivers**: `src/data/ports.ts` (`ProductsRepo` with `list` / `listOwn` /
  `create` / `update` / `remove` / `seedIfEmpty`, `Repositories`, ownership-error
  contract); `src/data/supabase/rows.ts` + `mappers.ts` (snake_case rows,
  `owner_id` ↔ `ownerId`, Date conversion, `23505` → exact Spanish duplicate
  message, 0-row update/delete → `OwnershipError`); `src/data/supabase/productsRepo.ts`.
- **Acceptance**: `list()` issues no owner filter (RLS-visible); `listOwn()` filters
  `owner_id = userId`; `seedIfEmpty` uses the owner-scoped count and upserts on
  `(owner_id,nombre)` with `ignoreDuplicates`; update/remove request `.select('id')`
  and map 0 rows to `OwnershipError`; `23505` maps to
  `Ya existe un producto llamado "<nombre>"`.
- **Checks**: `pnpm coverage` (hand-rolled stub of the `from()` chain), `pnpm lint`,
  `pnpm exec tsc -b`.
- **Route**: delegated. Trigger: frozen interface, independent adapter, stub-client
  unit tests, no UI decisions.
- **Forecast**: ~250–350 authored lines incl. tests.

### T7 — Products cache, `DataProvider`, local drafts repo, in-memory fakes + e2e stub

- **Delivers**: `src/data/ProductsCache.ts` (`useSyncExternalStore` snapshot);
  `src/data/DataProvider.tsx` + `useData.ts`; `src/data/local/draftsRepo.ts`
  (`produclist:quoteDraft`); `src/data/testing/inMemoryRepos.ts` +
  `stub.ts` seeded with `seedProducts`; `vitest.config.ts` excludes
  `src/data/testing/**` from coverage.
- **Acceptance**: snapshot is `undefined` until first load and retains the last
  snapshot on error; refresh on mount (StrictMode-safe), `visibilitychange → visible`,
  `window.online`, and after every mutation; fakes mirror the RLS-visible contract
  (`{ userId, isAdmin }`) including the admin global read; draft save/load/clear
  survive a refresh; coverage thresholds hold with testing excluded.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`.
- **Route**: inline. Trigger: cache/provider is the seam between hooks and fakes;
  StrictMode/refresh semantics need judgment.
- **Forecast**: ~250–350 authored lines incl. tests.

### T8 — Swap product/data hooks and components onto ports; local drafts; PDF path

- **Delivers**: `useProducts` (cache-backed, `Product[] | undefined`),
  `useAddProduct` / `useUpdateProduct` / `useDeleteProduct`, `useQuote` (via
  `DraftsRepo`), `QuoteProductSelector.tsx`, `src/pdf/ProductPDFDocument.tsx`
  (`products` prop), `PDFButton.tsx`, `App.tsx` products wiring; tests move to
  `DataProvider` + fakes.
- **Acceptance**: no `db` (Dexie) import remains in these files; product CRUD flows
  work via ports; drafts restore after refresh from `localStorage`; PDF renders from
  the passed products; first-load failure leaves `useProducts` `undefined` so the
  skeleton shows (not a misleading empty list).
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`,
  `pnpm exec playwright test`.
- **Route**: inline. Trigger: preserves UI contracts across many call sites; high
  coordination value in one author.
- **Forecast**: ~300–400 authored lines incl. tests.

### T9 — Quotes / list-sends / clients adapters + client-name merge

- **Delivers**: `src/data/supabase/quotesRepo.ts`, `listSendsRepo.ts`,
  `clientsRepo.ts`; `src/utils/clientNames.ts` (`mergeClientNames`);
  `src/types/quote.ts` moves `SavedQuote` / `QuoteDraft` / `DRAFT_KEY`; optional
  `ownerId` on types; `src/utils/clientTracking.ts` import fix.
- **Acceptance**: adapters expose `list` / `listOwn` per contract (fecha desc) and
  map 0-row remove to `OwnershipError`; `clients.listNames()` returns the
  RLS-visible union (admin sees all owners); stub-client unit tests pass.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`.
- **Route**: delegated. Trigger: mirrors T6 for the remaining repos; independent,
  stub-testable against a frozen contract.
- **Forecast**: ~250–350 authored lines incl. tests.

### T10 — Wire quotes/lists/clients through repos; owner-scoped backup service

- **Delivers**: `createBackupService(repos)` in `exportImport.ts` (export and
  preview/apply read+match `listOwn()`); `Cotizador.tsx`; `QuoteHistory.tsx`;
  `ClientPrices.tsx`; `App.tsx` backup + list-send + client-name wiring;
  `exportImport` tests move to fakes with owner-scoped matching cases.
- **Acceptance**: components stop importing `db`; a backup is exactly one user's
  partition even for the admin; import is additive/owner-scoped (products update by
  name among own rows; quotes + list sends merge by signature); re-import is a
  no-op; existing UI flows preserved.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`,
  `pnpm exec playwright test`.
- **Route**: inline. Trigger: final integration seam; owner-scoped backup and admin
  partition semantics need judgment.
- **Forecast**: ~300–400 authored lines incl. tests.

### T11 — Retire Dexie, `BackupReminder`, and IndexedDB test setup (cutover build)

- **Delivers**: delete `src/db/database.ts`, `src/db/seed.ts`, `src/db/__tests__/*`;
  create `src/data/seedProducts.ts` (44-product constant); `seedIfEmpty` per-user
  wiring; delete `BackupReminder.tsx`, `backupReminder.ts` + tests; drop
  `markBackedUp()`; `src/test-setup.ts` drops `fake-indexeddb/auto`; remove `dexie`,
  `dexie-react-hooks`, `fake-indexeddb` from `package.json`.
- **Acceptance**: no `db` (Dexie) imports remain in `src/`; no Dexie packages in
  `package.json`; `seedIfEmpty` yields exactly 44 owned rows per user on first
  authenticated load; `BackupReminder` surface gone; all checks green.
- **Checks**: `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`,
  `pnpm exec playwright test`.
- **Route**: inline. Trigger: destructive cutover; must confirm no residual call
  sites and name the rollback boundary precisely.
- **Forecast**: ~150–250 authored lines (largely deletions).

### T12 — CI hardening + server-first docs

- **Delivers**: confirm `.github/workflows/ci.yml` stays credential-free (`verify` =
  lint + `tsc -b` + `pnpm coverage`; `e2e` = Playwright with `VITE_E2E=1`); ensure no
  `fake-indexeddb` reference remains; `README.md` server-first docs (setup, env,
  migrations, account provisioning + admin `rol` `UPDATE`, per-device migration
  procedure, Free→Pro gate, manual v3 recovery path until Pro).
- **Acceptance**: README no longer claims "no backend / data only in IndexedDB";
  provisioning and per-device migration are reproducible from docs; `verify` +
  `e2e` green with no Supabase secrets.
- **Checks**: `pnpm lint`, `pnpm exec tsc -b`, `pnpm coverage`,
  `pnpm exec playwright test`; manual doc review.
- **Route**: inline. Trigger: operational docs tied to cutover + final CI
  verification; low code volume but high coordination.
- **Forecast**: ~120–200 authored lines (docs).

## Acceptance criteria (change-level)

Derived from the proposal Success Criteria:

- [ ] v3 export round-trips `products` + `quotes` + `listSends`; v1/v2 files still import.
- [ ] 5 named users sign in with email/password; unauthenticated access blocked; self-signup disabled.
- [ ] Vendor sees only own rows; cross-user INSERT/UPDATE/DELETE rejected; `owner_id` populated on every row from first insert.
- [ ] Admin has a global read view over all users' data but edits only own rows.
- [ ] Product-name uniqueness enforced per `(owner_id, nombre)`; 44 base products seeded per user on first authenticated load.
- [ ] Per-device import migrates each user's own v3 backup with zero `listSends` loss.
- [ ] UI unchanged apart from login screen, "Cerrar sesión", import-confirmation copy, `BackupReminder` retirement.
- [ ] Dexie removed from `package.json`; no Dexie `db` imports remain in `src/`.
- [ ] `verify` (lint, `tsc -b`, `pnpm coverage` at 60/55/60/60) and `e2e` green.
- [ ] Supabase upgraded to Pro (or explicit signed-off exception, owner Piwen) before salespeople rely on it.

## Applicable checks

Commands (exact): `pnpm coverage` (never `pnpm test`), `pnpm lint`,
`pnpm exec tsc -b`, `pnpm exec playwright test`. Strict TDD: tests are authored
with/before the behavior they verify; every code task includes its tests in the same
work unit. The SQL-only task (T3) has no CI unit check by design (Decision 14) and
is verified by the manual dev-project RLS probe.

| Task | coverage | lint | tsc -b | e2e | manual/dev |
|------|:--------:|:----:|:------:|:---:|:----------:|
| T1 | ✔ | ✔ | ✔ | – | – |
| T2 | ✔ | ✔ | ✔ | ✔ | – |
| T3 | regression | regression | regression | regression | migration apply + RLS probe |
| T4 | ✔ | ✔ | ✔ | – | – |
| T5 | ✔ | ✔ | ✔ | ✔ | – |
| T6 | ✔ | ✔ | ✔ | – | – |
| T7 | ✔ | ✔ | ✔ | – | – |
| T8 | ✔ | ✔ | ✔ | ✔ | – |
| T9 | ✔ | ✔ | ✔ | – | – |
| T10 | ✔ | ✔ | ✔ | ✔ | – |
| T11 | ✔ | ✔ | ✔ | ✔ | – |
| T12 | ✔ | ✔ | ✔ | ✔ | doc review |

Overall (change-level): every task green; coverage holds 60/55/60/60;
`verify` + `e2e` green throughout; manual RLS probe + integration checklist pass on
the dev project before cutover; per-device migration verification (row counts per
owner, `owner_id` everywhere, `ClientPrices` spot-check, admin global read, foreign
edit rejected, re-import adds zero duplicates).

## Progress / verification evidence / next step

T1 complete (Strict TDD, commit `b28240d7254017c7b09e4ec43cc96f53b8377b09`).
T2 complete (commit recorded below). T3 authored and **verified on the local
Supabase stack** (schema + RLS + grant hardening). T4 complete (client, env
typing, auth port + adapter with stub-client unit tests; checks green; native RDD
review **approved** and acknowledged). The tracker was synced with `master`
(merged #40) on 2026-10-08. T5 complete (auth gate, login/logout, config-error
screen and the credential-free `VITE_E2E` e2e gate; checks green; native RDD
review **approved** and acknowledged after one bounded correction of a CRITICAL
auth-bootstrap race). T6–T12 pending. No code, tests, builds or installs were
run for T6–T12.

| Task | Status | Evidence |
|------|--------|----------|
| T1 | done | RED: 10 new v3 tests failed on v2 code (`290 tests: 10 failed \| 280 passed`). GREEN: `pnpm coverage` 290/290 pass (thresholds 60/55/60/60 held: 65.91/62.36/67.73/67.27); `pnpm lint` clean; `pnpm exec tsc -b` exit 0. Route: delegated (planned inline). Commit: `b28240d7254017c7b09e4ec43cc96f53b8377b09` |
| T2 | done | Copy-only delta. TDD exception: no runnable test path asserts the App import copy (no App unit test; e2e only covers responsive/diagnose), so RED was not observable. `pnpm coverage` 290/290 pass (thresholds 60/55/60/60 held: 65.8/62.17/67.73/67.21); `pnpm lint` clean; `pnpm exec tsc -b` exit 0; `pnpm exec playwright test` 14 passed. Route: inline (executed inline). Commit: `780d2e87e7f2f3020fcc2c7bdd62ffb247f7d2cd` |
| T3 | done | Authored `supabase/config.toml` (CLI 2.101.0: `project_id="produclist"`, `enable_signup=false` on `[auth]` and `[auth.email]`, `[db.seed] enabled=false`) + `supabase/migrations/20261005000000_init.sql`, then hardened grants: Supabase's default privileges empirically grant `anon` ALL (incl. `TRUNCATE`, not RLS-filtered), so the migration now `revoke all ... from anon` and trims `authenticated` to SELECT/INSERT/UPDATE/DELETE. Verified on local stack (`supabase start` + `supabase db reset`, PG 17.6): apply clean; probe PASS — anon 0 grants and denied (clean table-ACL error); vendor sees only own (1); foreign UPDATE → 0 rows; duplicate own name → 23505; another owner may reuse the name; admin `is_admin()=true` reads all owners (2); trigger sets `rol='vendedor'`; `owner_id` = self on insert; no `42P17`. Route: inline. Commit: `4595001be9a93e0df82845eb7c8fbc572983121d`. |
| T4 | done | Added `@supabase/supabase-js@2.117.3`. RED → GREEN: `pnpm coverage` `Tests 315 passed (315)`, coverage 66.82/63.52/68.99/68.1 (60/55/60/60 held); `pnpm lint` exit 0; `pnpm exec tsc -b` exit 0 (orchestrator spot-check re-ran all three green). Native RDD review (lineage `review-82edf347033c4b7c`, tier high, 4 lenses) **approved** and acknowledged; 11 non-blocking advisory findings recorded as T5 follow-ups. Route: delegated. Commit: `d36f9ed338c03b1d279ca1d03d3adbb5eef0709c`. |
| T5 | done | `src/auth/AuthProvider.tsx` + `useAuth.ts` (status machine `loading/authenticated/unauthenticated` over the frozen `AuthPort`, race-guarded bootstrap); `LoginScreen.tsx` (Spanish copy, generic invalid-credentials error); `testing/fakeAuth.ts` (`createFakeAuth` + `createE2eAuth`); `Root.tsx` composition root (real Supabase port or `VITE_E2E=1` fake; config-error screen when env missing; gate); `main.tsx` renders `Root`; `App.tsx` "Cerrar sesión"; `playwright.config.ts` `webServer.env.VITE_E2E=1`; `e2e/auth.spec.ts`. RED: 4 new test files failed to resolve imports (`Test Files 4 failed \| 32 passed`, exit 1). GREEN: `pnpm coverage` `344 passed (344)` (36 files), coverage 69.03/65.03/71.6/70.17 (60/55/60/60 held); `pnpm lint` exit 0; `pnpm exec tsc -b` exit 0; `pnpm exec playwright test` 18 passed. Route: delegated (writer trigger: 10 new/modified non-trivial files). Native RDD review (lineage `review-691a232b1dab8818`, tier high, 4 lenses) **approved** and acknowledged after one bounded correction of CRITICAL `R3-auth-race` (`eventApplied` guard); 11 non-blocking advisory findings recorded below. Commit: `37566acf43c0d3c721dc043cc474372239a2d4fa`. |
| T6 | pending | – |
| T7 | pending | – |
| T8 | pending | – |
| T9 | pending | – |
| T10 | pending | – |
| T11 | pending | – |
| T12 | pending | – |
| Change acceptance | pending | – |

### T1 evidence detail

- **Deliverable**: `BACKUP_VERSION = 3`; `BackupFile.listSends`; `exportBackup`
  reads `db.listSends`; `parseProductImport` returns `listSends` (v1/v2 → `[]`);
  `ImportPreview.listSendsToAdd`; `ImportResult.listSendsAdded`;
  `listSendSignature()` (JSON of `{ fecha: ISO, cliente: trimmed+lowercased,
  items: [{nombre, formato, precioNeto, precioBruto}] }`); `applyImport` merges
  list sends by signature (re-checks the DB, so a stale preview is a no-op too).
- **Acceptance proven**: v3 round-trips `products` + `quotes` + `listSends`; v1
  bare array and v2 file import unchanged with `listSends = []`; re-importing the
  same v3 file is a no-op; signature merge adds only unseen sends.
- **Executed route**: `delegated (writer trigger: 2 non-trivial files)`.
- **Commit**: `b28240d7254017c7b09e4ec43cc96f53b8377b09` — `feat(backup): add v3 export/import with list sends`.

### T2 evidence detail

- **Deliverable**: `src/App.tsx` import copy now reports list-send counts. The
  confirmation `importMessage` appends `y <n> listas enviadas` (from
  `importPreview.listSendsToAdd`) and the success toast appends
  `<n> listas enviadas` (from `result.listSendsAdded`) alongside the existing
  product/quote counts. No other copy or markup changed.
- **Acceptance proven**: confirmation and summary copy report list sends; existing
  product/quote/error copy is untouched; `listSendsToAdd`/`listSendsAdded` come
  straight from the T1 contract (no logic change).
- **TDD exception**: no runnable deterministic test path exists for this copy.
  There is no `App` unit test (`src/**/App.test.tsx` absent), and the only e2e
  specs (`responsive.spec.ts`, `diagnose.spec.ts`) assert layout, not import copy.
  Extending a test would have required authoring a new App test harness out of this
  task's budget; per the TDD rule the exception is stated explicitly and the
  applicable checks were relied on instead.
- **Executed route**: `inline` (tiny copy delta in the same PR as T1; no
  independent interface).
- **Commit**: `780d2e87e7f2f3020fcc2c7bdd62ffb247f7d2cd` — `feat(backup): report list-send counts in import summary`.

### T3 evidence detail

- **Deliverables authored**:
  - `supabase/config.toml` — generated with `supabase init` (CLI 2.101.0) and
    adjusted per design: `project_id = "produclist"`, `[auth] enable_signup =
    false` and `[auth.email] enable_signup = false` (Decision 8:
    dashboard-provisioned accounts only), and `[db.seed] enabled = false`
    (Decision 7: no SQL seed; the generated default pointed at a nonexistent
    `./seed.sql`). No other option changed.
  - `supabase/migrations/20261005000000_init.sql` — the design's
    "Schema / RLS / trigger" block: `productos` / `cotizaciones` /
    `listas_enviadas` / `perfiles`; `owner_id uuid not null default auth.uid()
    references auth.users (id)` on the three data tables; `perfiles.rol` check
    `('admin','vendedor')`; unique index `productos_owner_nombre_key (owner_id,
    nombre)`; `(owner_id, fecha desc)` indexes on `cotizaciones` and
    `listas_enviadas`; `is_admin()` `stable` `security definer`
    `set search_path = ''` with `revoke all ... from public, anon` and
    `grant execute ... to authenticated`; RLS enabled on all four tables;
    `select_own_or_admin` / `insert_own` / `update_own` / `delete_own` policies
    on the three data tables plus `perfiles_select_own_or_admin`;
    `handle_new_user` trigger inserting `rol = 'vendedor'` never sourced from
    user metadata; documented idempotent admin-promotion `UPDATE`.
- **Grant hardening (design correction, empirically found)**: the design notes
  claim "Anon has no policies and no grants, therefore no access". On the
  Supabase stack this is false: `alter default privileges` grants `anon` (and
  `authenticated`) `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` on
  every new `public` table. RLS still blocks anon reads/writes (no anon policy),
  but **`TRUNCATE` is not subject to RLS**. The migration now explicitly
  `revoke all ... from anon` on the four tables and `revoke
  truncate, references, trigger ... from authenticated`, then re-grants the
  four DML privileges to `authenticated`. Post-hardening probe: `anon` has 0
  grants and gets a clean `permission denied for table productos`.
- **Acceptance proven (local stack, `supabase start` + `supabase db reset`,
  PostgreSQL 17.6)**:
  - migration applies cleanly (no error, no missing `seed.sql`);
  - anon denied with a clean table-ACL error;
  - vendor A: `select count(*) from productos` = 1 (own rows only); update of
    vendor B's row → `UPDATE 0` (silent RLS filter);
  - admin: `is_admin()` = true, sees all owners' rows (2), and `perfiles`
    visible = 3; no `42P17` recursion on any read;
  - `handle_new_user`: three users provisioned with `rol = 'vendedor'`; admin
    promotion `UPDATE` idempotent;
  - `owner_id` populated from `auth.uid()` on first insert;
  - uniqueness `(owner_id, nombre)`: duplicate own name → `23505`; another owner
    may reuse the same name.
- **Environment defect found (known Supabase local-image bug, not our SQL)**:
  on the local stack, calling a function the current role lacks `EXECUTE` on
  segfaults the backend (signal 11 → cluster recovery) instead of raising a clean
  `42501 permission denied for function`. Confirmed the affected roles are exactly
  `anon` / `authenticated` / `service_role` (a custom role returns a clean error),
  which matches `supautils.hint_roles` (Supabase preload library) defaulting to
  those three roles. Root cause: **`supautils`** — fixed upstream in v3.2.2 and in
  the postgres image `>= 17.6.1.121`. `supabase start` (CLI 2.101.0) provisioned
  `public.ecr.aws/supabase/postgres:17.6.1.106`, which still ships the bug. Sources:
  supabase/postgres#2112, supabase/cli#6094, supabase/supautils#225.
- **Local-only, but reachable over the local API**: per supabase/cli#6094 the
  crash is triggerable locally via `POST /rest/v1/rpc/<fn>` with the public anon
  key for any function lacking `EXECUTE` for `anon`. This is a local-dev DoS only;
  hosted Supabase runs fixed images. It is **not** caused by, and does not affect,
  this migration's correctness.
- **Verified workaround (local DB)**: as `supabase_admin`,
  `alter system set supautils.hint_roles = ''` + `select pg_reload_conf()`; after
  that, `anon`/`authenticated` calls to a revoked function return a clean
  `ERROR: permission denied for function`. It lives in `postgresql.auto.conf`
  (survives a container restart, not `supabase db reset`). Durable fix: update the
  Supabase CLI so `supabase start` provisions `postgres >= 17.6.1.121`.
- **Durable fix applied and verified (2026-10-08)**: Supabase CLI updated
  `2.101.0 → 2.120.0`; `supabase start` now provisions
  `public.ecr.aws/supabase/postgres:17.11.0.004`. With the stock
  `supautils.hint_roles` default (`anon, authenticated, service_role`) and **no
  workaround**, the revoked-function probe now returns a clean
  `ERROR: permission denied for function` for all three roles, and the full T3
  RLS probe re-passed. `config.toml` was not rewritten by the CLI (no repo
  change). Still pending: the same probe on the linked dev project once it exists
  (no project is linked yet).
- **Route**: inline. Trigger: security boundary and cross-slice schema contract
  every adapter depends on; needs design sign-off.
- **Commit**: `4595001be9a93e0df82845eb7c8fbc572983121d` — `feat(supabase): add Phase 1 schema, RLS and provisioning`.

### T4 evidence detail

- **Deliverables authored**:
  - `package.json`, `pnpm-lock.yaml` — `pnpm add @supabase/supabase-js` →
    `+ @supabase/supabase-js 2.117.3`.
  - `src/vite-env.d.ts` — `ImportMetaEnv` extended with `VITE_SUPABASE_URL?`,
    `VITE_SUPABASE_ANON_KEY?`, `VITE_E2E?`, exactly as the design's Env/bootstrap
    block.
  - `src/data/supabase/client.ts` — `SupabaseEnv`/`SupabaseConfig`,
    `SupabaseConfigError`, `readSupabaseConfig`, `assertSupabaseConfig`,
    `createSupabaseClient(env, factory?)`. The module never calls the config
    assertion at import time; the default env/factory are evaluated per call, so
    importing it cannot break tests. Missing config throws `SupabaseConfigError`
    (the configuration-error path consumed by T5's error screen); the client is
    only constructed once valid config exists.
  - `src/auth/ports.ts` — frozen `AuthSession` + `AuthPort` verbatim from the
    design (no extra members): `getSession`, `onAuthStateChange`, `signIn`,
    `signOut`.
  - `src/auth/supabaseAuth.ts` — `createSupabaseAuth(client: Pick<SupabaseClient,
    'auth'>)`. `getSession` maps `session.user.id`/`email`; `onAuthStateChange`
    maps `(event, session)` and relies on Supabase's automatic `INITIAL_SESSION`
    emission (the named initial-session case), returning an unsubscribe closure;
    `signIn` calls `client.auth.signInWithPassword` and maps invalid credentials
    to `INVALID_CREDENTIALS_MESSAGE`; `signOut` delegates. Parameter narrowed to
    the `auth` surface so any `createClient` result (and the test stub) is
    structurally assignable without generic-parameter friction.
  - `src/types/profile.ts` — `ProfileRole = 'admin' | 'vendedor'` and
    `Profile { id, email, nombre, rol }` per the design.
- **Tests (Strict TDD, injected stub, no network)**: `src/data/supabase/__tests__/client.test.ts`
  (9 cases: env read + assert + factory construction + config-error path),
  `src/auth/__tests__/supabaseAuth.test.ts` (14 cases: getSession mapping/error,
  `INITIAL_SESSION`/`SIGNED_IN`/`SIGNED_OUT` delivery, unsubscribe, signIn
  success/invalid-credentials/other error, signOut success/error), and
  `src/types/__tests__/profile.test.ts` (2 type-shape cases). 25 authored test
  cases; +23 executed tests once the two missing modules existed.
- **Ambiguity resolved (design followed literally)**: the design's `AuthPort`
  declares `signIn(email, password)` while the tracker deliverable and Slice 3
  table name `signInWithPassword` (the Supabase method). The port keeps `signIn`;
  the adapter implements it over `client.auth.signInWithPassword`. The design
  does not name the invalid-credentials string, so the adapter exports
  `INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.'` (app's
  Spanish convention) for T5's LoginScreen to reuse.
- **Commands run (foreground)**:
  - `pnpm coverage` (RED, before impl): `Test Files 2 failed | 30 passed (32)`,
    `Tests 292 passed (292)`, exit 1.
  - `pnpm coverage` (GREEN, final): `Test Files 32 passed (32)`,
    `Tests 315 passed (315)`; `Statements 66.82% (828/1239)`,
    `Branches 63.52% (432/680)`, `Functions 68.99% (247/358)`,
    `Lines 68.1% (771/1132)` → 60/55/60/60 held; exit 0.
  - Per-file: `supabaseAuth.ts` 100/93.75/100/100 (23/23 stmts, 9/9 funcs,
    15/16 branches); `client.ts` 100/100/100/100 (14/14 stmts, 11/11 branches);
    `ports.ts` and `profile.ts` carry no executable statements.
  - `pnpm lint`: exit 0 (one initial `no-unsafe-return` on the generic
    `createClient` return was fixed by typing the factory return as
    `ReturnType<typeof createClient>`).
  - `pnpm exec tsc -b`: exit 0.
- **Route**: delegated (self-contained adapter behind a frozen `AuthPort`, no UI
  or composition decisions, fully stub-testable).
- **Native RDD review (approved)**: candidate frozen at tree
  `c106d633a3eb2fe020b7d88638751dbff37daeba` (11 files, 558 changed lines, tier
  high); four lenses (risk / resilience / readability / reliability) all admitted
  and positive; closure `state: approved`; acknowledgement burned
  (`gentle-ai.review-acknowledged/v1`, `authority: burned`, lineage
  `review-82edf347033c4b7c`). No BLOCKER or CRITICAL finding.
- **Non-blocking advisory findings (later work; do NOT re-review this candidate)**:
  R1-A — test fixtures use plausible real corporate emails
  (`@example.com`), prefer fictional `example.com`; R2-1 / R3-1 / R4-3 — the
  `AuthPort.signIn` contract says "user-safe message" but the adapter rethrows the
  raw Supabase `error.message` for non-credential failures; R2-2 —
  `isInvalidCredentials` lacks a comment for its two sources (code + vendor
  message regex); R2-3 / R3-2 — `onAuthStateChange` discards the event, so
  `INITIAL_SESSION(null)` and `SIGNED_OUT` are indistinguishable to consumers;
  R3-3 — the invalid-credentials test asserts against the exported constant
  (self-referential), leaving the literal copy unproved; R4-1 — `signOut` has no
  local-scope fallback when the network revoke fails; R4-2 — `getSession`
  rethrows instead of resolving `null` on a transient refresh failure; R4-4 — the
  config error does not name which env var is missing. T5 should decide which to
  fold in.
- **Commit**: `d36f9ed338c03b1d279ca1d03d3adbb5eef0709c` — `feat(supabase): add client and auth adapter`.

### T5 evidence detail

- **Deliverables**: `src/auth/AuthProvider.tsx` + `useAuth.ts` (auth context, status
  machine `loading | authenticated | unauthenticated`), `src/auth/LoginScreen.tsx`
  (email/password, Spanish copy, single generic error), `src/auth/testing/fakeAuth.ts`
  (`createFakeAuth` for unit tests, `createE2eAuth` for `VITE_E2E`), `src/Root.tsx`
  (composition root: real Supabase port, else the E2E fake; `ConfigErrorScreen` when
  env is missing; gate `loading → LoginScreen → App`), `src/main.tsx` renders `Root`,
  `src/App.tsx` "Cerrar sesión" in the hamburger menu, `playwright.config.ts`
  `webServer.env: { VITE_E2E: '1' }`, `e2e/auth.spec.ts`.
- **Route**: delegated (writer trigger: 10 new/modified non-trivial files).
- **Native RDD correction**: the reliability lens found a CRITICAL candidate-caused
  race in the provider bootstrap — an initial `getSession()` resolving or rejecting
  after an `onAuthStateChange` event could clobber the fresher state. Fixed with an
  `eventApplied` guard (the initial result is applied only when no event has landed)
  plus two regression tests that interleave a pending `getSession()` with an emitted
  session; `pnpm coverage` 344 green; the targeted validator admitted → `state:
  approved`; authority burned.
- **Branch / PR**: `feat/auth-ui` → **PR #43**, base = the synced tracker branch
  `feat/phase-1-supabase-migration`.
- **Commit**: `37566acf43c0d3c721dc043cc474372239a2d4fa` —
  `feat(auth): gate the app behind Supabase login`.

### Advisory findings from the T5 review (non-blocking, follow-ups for later tasks)

Recorded from the approved review; none opened a correction. Treat as separate later
work, never as a reason to re-review this candidate.

- `R1-e2e-auth-bypass` (WARNING, `src/Root.tsx:12-14`) — the E2E fake auth is imported
  into `Root` and activated by the build-time `VITE_E2E` flag; a production build made
  with the flag set would ship the bypass. Consider guarding/stripping this in T12.
- `R2-001` (WARNING, `src/auth/testing/fakeAuth.ts:50-85`) — `createE2eAuth` duplicates
  `createFakeAuth`; factor the shared port.
- `R2-002` (WARNING, `src/App.tsx:150-155`) — sign-out failure only `console.error`s,
  next to the component's existing toast convention.
- `R2-003` / `R2-004` / `R2-005` (SUGGESTION) — the invalid-credentials literal is
  declared in three places; the `testing/` factory sits on the shipping render path;
  the `e2e:auth` key/sentinel is a bare literal in three of four sites.
- `R3-playwright-env-reuse` (WARNING, `playwright.config.ts:12`) —
  `reuseExistingServer` can reuse a server started without `VITE_E2E`, flaking the
  default-authenticated assertion locally even though it is deterministic in CI.
- `R3-unverifiable-auth-port` (SUGGESTION, `src/Root.tsx:6-8`) — the real adapter is
  outside this candidate's paths; its production wiring is unproved here.
- `R4-A` (WARNING, `src/auth/AuthProvider.tsx`) — a rejected `getSession()` silently
  collapses to unauthenticated (no log/retry/backoff).
- `R4-B` (WARNING, `src/Root.tsx:46`) — no bounded wait; a hung `getSession()` leaves
  the loading screen indefinitely.
- `R4-C` (SUGGESTION, `src/auth/LoginScreen.tsx`) — every sign-in failure maps to the
  generic message with no logging, so outages look like bad credentials.

Operational milestones (not authored work units):

- M1 (pre-cutover): slice 1 merged to `master`; tracker slices green; dev-project
  migrations + 5 dev accounts + admin `rol` + RLS probe + integration checklist done.
- M2 (cutover): every user exports v3 on their own device and freezes entry; prod
  resources created; tracker merged to `master` and deployed.
- M3 (post-cutover): each user signs in on their own device, gets the 44-product
  seed, imports their own v3 file; per-user verification above passes.
- M4 (go-live gate): upgrade to Pro or sign off the exception (owner: Piwen).

**Next step**: T6 (repository ports + Supabase products adapter + mappers/errors),
consuming the frozen `Repositories` contract. T5 is closed — reviewed (approved) and
its 11 advisory findings are listed above for T6+ to weigh. Before cutover, re-run the
T3 RLS probe against the linked dev project (Decision 14) and run the regression sweep
(`pnpm lint`, `pnpm exec tsc -b`, `pnpm coverage`, `pnpm exec playwright test`).

## Delivery strategy + slice boundaries

- **Strategy**: `auto-chain` (feature-branch chain). Per `chained-pr` and
  `work-unit-commits`: one deliverable work unit per PR where cohesive; tests/docs
  travel with their unit; never shrink a diff to fit the budget.
- **Budget**: 400 changed lines is an advisory heuristic per task; the real
  delivery budget reads the accumulated branch. Forecast below is
  `authored additions + deletions` per task; PR totals are the sum of the tasks it
  holds and should stay within the advisory budget (split further if not).
- **Feature branch chain**: PR1 targets `master` and merges immediately (Dexie-era
  value, unaffected by the tracker). PR2–PR11 stack on a tracker branch. The tracker
  merges to `master` **once**, at cutover (PR11 carries the cutover build, which has
  no Dexie). Each child PR carries a dependency diagram marking itself `📍`;
  follow-up work and out-of-scope items are stated in each PR body.

| PR | Phase | Work units | Target | Forecast (add+del) |
|----|-------|-----------|--------|--------------------|
| PR1 | backup-v3 | T1, T2 | `master` | ~200–300 |
| PR2 | supabase-schema | T3 | tracker | ~180–260 |
| PR3 | supabase-auth | T4 | tracker (PR2) | ~150–220 |
| PR4 | supabase-auth | T5 | tracker (PR3) | ~220–320 |
| PR5 | data-access-products | T6 | tracker (PR4) | ~250–350 |
| PR6 | data-access-products | T7 | tracker (PR5) | ~250–350 |
| PR7 | data-access-products | T8 | tracker (PR6) | ~300–400 |
| PR8 | data-access-quotes-lists | T9 | tracker (PR7) | ~250–350 |
| PR9 | data-access-quotes-lists | T10 | tracker (PR8) | ~300–400 |
| PR10 | retire-dexie | T11 | tracker (PR9) | ~150–250 |
| PR11 | CI + docs (cutover) | T12 | tracker → `master` at cutover | ~120–200 |

Rollback: before any Supabase write, revert the tracker and redeploy the previous
`master` build (Dexie intact). After writes, redeploy the previous build and
re-import each user's latest v3 file into Dexie; Supabase writes made post-cutover
are not carried back. Fix-forward per user (delete that user's rows, re-import) while
server rows are disposable.

## Rationale for meaningful accepted decisions

- **Numeric `bigint identity` PKs** (not uuid): the codebase, types, test fixtures
  and React keys already use `number`; uuid would ripple for zero Phase-1 benefit and
  identity values stay far below 2^53. `owner_id` is a separate uuid concern.
- **Private-per-user rows + admin read-only via RLS**: RLS is the single enforcement
  point; app reads add no owner filter. The admin's global view is additive and
  read-only; a shared catalog was explicitly reversed.
- **Non-recursive `SECURITY DEFINER is_admin()`**: an invoker read of `perfiles`
  inside its own policy would trigger `42P17`; running as the definer with a pinned
  empty `search_path` breaks the cycle safely.
- **`(owner_id, nombre)` uniqueness**: two vendors may owe the same name with
  different prices; the constraint still retires `deduplicateProducts`. `23505` maps
  to the existing Spanish message.
- **`items` as `jsonb`**: items are snapshots, never joined; one round trip, no
  multi-statement transaction (supabase-js lacks one), and normalization can be added
  later if reporting arrives (out of scope).
- **Per-user seed on first authenticated load**: single source of truth (same
  constant feeds the e2e stub), environment-agnostic, idempotent via owner-scoped
  count + `ignoreDuplicates` upsert.
- **Drafts in `localStorage` behind `DraftsRepo`**: ephemeral single-slot autosave,
  deliberately excluded from backups; survives refresh even offline.
- **Per-device migration**: reuses the tested import path once per user, sets
  `owner_id` automatically from `auth.uid()`, and needs no cross-user reconciliation
  because import is additive/owner-scoped and re-imports are no-ops. A single
  canonical run would mis-attribute four vendors' data to the admin.
- **Retire `BackupReminder`**: its premise ("device loss loses your data") becomes
  false with server data; Pro is the go-live backup gate. Deliberate removal of a
  now-false affordance, not a redesign.
- **No offline UX / no Realtime**: accepted server-first trade-off; defined and
  honest failure behavior (existing toasts, `undefined` → skeleton) without
  channel-lifecycle/test complexity beyond budget.
- **Fakes + `VITE_E2E` stub, no Supabase secrets in CI**: keeps `verify` + `e2e`
  credential-free and coverage honest; RLS itself is exercised by the manual
  dev-project probe, not CI (no credentials; Free projects pause).
- **Feature-branch chain with a single cutover merge**: users are never stranded on
  a login gate with an empty workspace; review budget respected; rollback is a
  redeploy.

---

Repository-relative locator: `odd/tasks/phase-1-supabase-migration.md`.

Engram mirror: topic key `odd/phase-1-supabase-migration/tasks` (project
`produclist-pwa`). Status: **written in-session and read back**; if the mirror write
had failed it would be marked pending here.
