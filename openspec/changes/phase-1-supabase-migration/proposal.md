# Proposal: Phase 1 — Supabase Migration (Server-First)

## Intent

`produclist` is a local-first PWA: all data lives in IndexedDB via Dexie on a single
device, with no backend and no auth. Each salesperson's device is an island — a lost
or replaced device means lost products, quotes, and "last price sent to each client".
There is also no cloud persistence, no multi-device access, and the commercial lead
has no global view of the team's data.

This change moves `produclist` from local-first Dexie/IndexedDB to **Supabase
(server-first)** with per-user email/password auth. Each salesperson keeps their
**own private list and their own prices**: `productos`, cotizaciones, and listas
enviadas are **private per user**, and only the user who owns a row can insert,
update, or delete it. The admin gets a **global READ view** over
everyone's data for supervision, but edits only his own rows. **The UI does not
change in Phase 1 apart from the accepted deltas** (login screen, "Cerrar sesión"
menu item, import-confirmation copy, `BackupReminder` retirement): this is a
data-layer migration, not a product redesign.

The value of the migration is **cloud persistence + multi-device + no data loss on
device loss + the commercial lead's global view** — NOT collaboration between vendors.

## Scope

### In Scope

1. Supabase project (region `southamerica-east1` São Paulo) + Postgres schema:
   `productos`, `cotizaciones` (+ items), `listas_enviadas` (+ items), `perfiles` —
   **all with `owner_id` (private per user)**; `perfiles` gains a `rol` column
   (`'admin' | 'vendedor'`) introducing a minimal admin/vendor role in Phase 1.
2. Supabase Auth email/password + 5 dashboard-provisioned `example.com`
   accounts with manual passwords and self-signup disabled: `admin@` (admin),
   `vendedor1@`, `vendedor2@`, `vendedor3@`, `vendedor4@` (vendedores).
3. RLS: `SELECT = owner_id = auth.uid() OR is_admin(auth.uid())`;
   `INSERT/UPDATE/DELETE = owner_id = auth.uid()` only. `owner_id` populated from
   the first insert (`NOT NULL DEFAULT auth.uid()`).
4. Product-name uniqueness becomes **`(owner_id, nombre)`** (per-user, not global).
5. Seed of the 44 base products **per user** on that user's first authenticated load.
6. Export/import **v3** (adds `listSends`) + **per-device migration**: each user, on
   first login on their device, imports their own v3 backup with `owner_id` set to
   the logged-in user.
7. Accepted UI deltas only: login screen, "Cerrar sesión" menu item,
   import-confirmation copy, `BackupReminder` retirement. Otherwise UI unchanged.
8. Retire Dexie and point the repository/data-access layer (ports & adapters) at
   Supabase, keeping the UI unchanged apart from the accepted deltas.
9. IDs: Postgres `bigint identity`, numeric domain types preserved.
10. Keep existing CI (`verify` + `e2e`) green.

### Out of Scope

- Shared catalog or any cross-vendor collaboration/editing (each vendor's list is private).
- Cross-user edit conflicts / optimistic locking — no conflicts exist under the
  private-per-user model, so this item is dropped entirely.
- ACH sales-report ingestion.
- Metabase or any reporting integration.
- Any new product features beyond the migration and the accepted UI deltas.
- Offline UX: server-first removes the current offline capability. This is an
  **accepted trade-off** for Phase 1 — silent failures on flaky networks are possible
  and no offline banner/cache is built. (Revisit only if salespeople report pain.)

## Capabilities

> Contract with the spec phase: each New Capability gets a full spec at
> `openspec/changes/phase-1-supabase-migration/specs/<name>/spec.md`.
> `openspec/specs/` is currently empty, so there is nothing to modify — all behavior
> below is new at the spec level.

### New Capabilities

- `supabase-schema`: Postgres tables (`productos`, `cotizaciones` + items,
  `listas_enviadas` + items, `perfiles` with `rol`), per-user `owner_id` columns
  with `NOT NULL DEFAULT auth.uid()`, per-user uniqueness `(owner_id, nombre)`
  replacing `deduplicateProducts`, per-user seed of the 44 base products, and the
  private-per-user + admin-read RLS policy.
- `supabase-auth`: email/password sign-in, auth gate at the composition root, the 5
  named `example.com` profiles (1 admin + 4 vendedores via `perfiles.rol`),
  self-signup disabled, login screen + "Cerrar sesión" menu item.
- `supabase-data-access`: repository/data-access layer (ports & adapters) replacing
  every Dexie call (hooks, `QuoteHistory.tsx`, `ClientPrices.tsx`, draft autosave
  home), enforcing per-user ownership on writes and admin-read on reads, preserving
  current UI contracts; Dexie dependency retired.
- `backup-v3`: export/import format v3 including `listSends` (backward-compatible
  read of v1/v2), list-send content-signature merge, import-confirmation copy,
  `BackupReminder` retirement, and the per-device real-data migration procedure
  (each user imports their own v3 backup as `owner_id` = self) gated on v3.

### Modified Capabilities

None — no existing `openspec/specs/` capabilities; current Dexie behavior is
superseded by the new capabilities above, not modified.

## Approach

Adopt exploration **Approach 2 (repository/data-access layer)** over an in-place
Dexie swap: define typed repository interfaces (`ProductsRepo`, `QuotesRepo`,
`ListSendsRepo`, `DraftsRepo`), implement them against `supabase-js`, and have hooks
and the two `db`-importing components depend on the interfaces. This keeps the UI
unchanged (apart from the accepted deltas), isolates the Dexie retirement to one
adapter, and keeps `verify` meaningful — unit tests target in-memory fakes instead
of a mocked network client, so coverage thresholds (60/55/60/60) survive without
vacuous tests.

**Ownership model**: every read goes through RLS (`SELECT = owner_id = auth.uid()
OR is_admin(auth.uid())`); every write sets `owner_id = auth.uid()` and RLS
rejects cross-user `INSERT/UPDATE/DELETE`. The admin's global view is read-only in
practice (admin edits only his own rows). `perfiles.rol` (`'admin' | 'vendedor'`)
backs `is_admin(auth.uid())`; avoid RLS recursion on `perfiles` (security-definer
helper or equivalent, decided in design).

**Hard ordering**: export/import **v3 lands FIRST** as an independently testable work
unit against the current Dexie app (verified blocking finding: v2 exports only
`products` + `quotes`; migrating on v2 permanently loses the list-send half of
client price history). Only then: schema + auth + RLS → adapter swap → per-device
real-data migration → CI hardening.

**Migration is per device**: each user, on first login on their device, imports
their own v3 backup; `owner_id` = the logged-in user. There is no single canonical
run from one device. The 44 base products are seeded per user on first
authenticated load, and product-name uniqueness is enforced per `(owner_id, nombre)`.

**ID strategy**: Postgres `bigint identity` preserving today's numeric `id` /
`productId: number` types and UI keys.

**Drafts**: `drafts` is an ephemeral single-slot autosave row — excluded from backups
by design; give it a browser-local home (`localStorage`) rather than a server table,
confirmed in design.

**Delivery**: total work exceeds the 400-line review budget → ship as **chained/stacked
PRs** (one per work unit, in the order above) with `verify` + `e2e` green throughout.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/utils/exportImport.ts` | Modified | v2 → v3: add `listSends` to `BackupFile`, writer, `parseProductImport`, `ImportPreview`, `applyImport`; list-send content signature; import-confirmation copy; `BACKUP_VERSION = 3` |
| `src/db/database.ts` | Removed | Dexie schema + all CRUD/draft/list-send helpers retired; replaced by repositories |
| `src/db/seed.ts` | Modified | 44-product seed moves server-side (SQL migration or first-authenticated-load seed) **per user**; each copy owned by its user |
| `src/hooks/useProducts.ts` | Modified | `useLiveQuery` → repository query/subscription, same `Product[] \| undefined` contract, scoped to `owner_id = self` |
| `src/hooks/useAddProduct.ts`, `useUpdateProduct.ts`, `useDeleteProduct.ts` | Modified | Point at `ProductsRepo`; duplicate-name rule becomes per-user `(owner_id, nombre)` DB constraint + error mapping |
| `src/hooks/useQuote.ts` | Modified | Draft autosave moves off Dexie (browser-local) |
| `src/components/QuoteHistory.tsx` | Modified | Stop importing `db` directly; go through the data layer (private-per-user reads) |
| `src/components/ClientPrices.tsx` | Modified | Stop reading `db.listSends`/`db.quotes` directly; go through the data layer (private-per-user reads) |
| `src/App.tsx` | Modified | Auth gate/provider, per-user seed call, export/import + list-send wiring; login screen + "Cerrar sesión" menu item (accepted deltas) |
| `src/types/product.ts`, `src/types/quote.ts`, `src/types/listSend.ts` | Modified | Numeric `bigint identity` IDs + `owner_id` additions; `perfiles.rol` type |
| `src/utils/clientTracking.ts`, `src/utils/listSend.ts` | Unchanged | Pure logic; stays as-is |
| `src/utils/backupReminder.ts` | Removed | Retired: rationale disappears with server persistence (accepted delta) |
| `package.json`, `vite.config.ts`, `src/vite-env.d.ts` | Modified | Add `@supabase/supabase-js`, env typing; remove Dexie deps |
| `.github/workflows/ci.yml` | Modified | Supabase test strategy (seeded test project + secrets, or mock/stub auth path) |
| `src/db/__tests__/*`, `src/utils/__tests__/exportImport.test.ts`, `src/hooks/__tests__/*` | Modified | Off `fake-indexeddb/auto` onto in-memory repository fakes |
| `e2e/*.spec.ts` | Modified | Auth changes first interaction (login screen); needs a test auth path |
| `README.md` | Modified | "Sin backend / datos sólo en IndexedDB" claims become false |
| Supabase project (dashboard/SQL migrations) | New | Schema with `owner_id` + `perfiles.rol`, RLS (private writes + admin read), 5 `example.com` accounts, per-user seed; **Free tier = dev/migration only**, gate to Pro before real use |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data loss if export v3 slips (v2 drops all `listSends`) | High impact / Med | Hard gate: no real-data migration until v3 ships and is tested; each user takes a v3 backup immediately before their per-device import |
| `owner_id` missing on first insert → ownerless rows | Med | `NOT NULL DEFAULT auth.uid()` in schema before any real insert + explicit set on insert |
| RLS misconfiguration leaks private vendor data (e.g. over-broad SELECT) | High impact / Med | Private-by-default policies + `is_admin()` helper; e2e/security test: vendor A cannot read vendor B rows, admin can read all but writes only own |
| `is_admin()` recursion on `perfiles` locks all reads | Med | Security-definer helper or non-recursive policy; decided and tested in design before real data |
| Per-device migration ordering confusion (user migrates twice / wrong account) | Med | Import-confirmation copy + first-login guard; each import stamps `owner_id` = logged-in user; idempotent per-user seed |
| Seed duplication (44 base products imported twice for the same user) | Med | Per-user seed guard (seed once per `owner_id`); `(owner_id, nombre)` dedupe on import |
| Offline regression (server-first, no offline UX) | High | Explicitly accepted out of scope; document for salespeople; revisit only on reported pain |
| CI has no Supabase credentials/test strategy | High | Decide in design: seeded test project + secrets vs mock/stub auth; unit tests must never need a live project |
| Supabase Free limits (no auto backups, ~1-week idle pause) | High | Free = dev/migration only; gate to Pro before salespeople use it (owner: Piwen); keep per-user v3 JSON backups until Pro |
| Review-budget blowout (naive swap touches everything) | Med | `auto-chain`: one stacked PR per work unit, `verify` + `e2e` green throughout |

## Rollback Plan

- **Before migration**: every stacked PR is independently revertible; Dexie code is
  removed LAST, so reverting the adapter PRs restores the local-first app untouched.
- **Migration safety net**: each user takes a v3 JSON backup immediately before
  their per-device import. If the migration corrupts server state for a user,
  fix-forward on Supabase (delete that user's rows and re-run the import from their
  v3 file) — server rows are disposable until salespeople go live.
- **After go-live**: rollback = redeploy the last pre-Supabase build and re-import
  each user's latest v3 backup into Dexie (v3 import code runs against local Dexie,
  so the path stays working until Dexie is retired). v3 remains readable: the reader
  accepts v1/v2/v3.
- No rollback path preserves data written to Supabase *after* a revert — communicate
  the cutover point to the 5 users.

## Dependencies

- Supabase project created in `southamerica-east1` (Free tier for dev/migration;
  **Pro upgrade gated before real salesperson use**, owner: Piwen).
- The 5 `example.com` accounts dashboard-provisioned with manual passwords and
  self-signup disabled (`admin@` admin, `vendedor1@`, `vendedor2@`, `vendedor3@`,
  `vendedor4@`).
- CI/e2e test strategy decision (design): seeded test project + secrets vs mocked
  auth/data layer. No credentials exist today.
- Export/import v3 lands before any migration (highest-severity ordering
  constraint); per-device migration replaces the old single-canonical-run premise.

## Success Criteria

- [ ] v3 export round-trips `products` + `quotes` + `listSends`; v1/v2 files still import.
- [ ] 5 named users sign in with email/password; unauthenticated app access is blocked; self-signup is disabled.
- [ ] Vendor sees only their own rows; vendor INSERT/UPDATE/DELETE on another user's rows is rejected; `owner_id` is populated on every row from the first insert.
- [ ] Admin has a global read view over all users' data but edits only his own rows.
- [ ] Product-name uniqueness enforced per `(owner_id, nombre)`; 44 base products seeded per user on first authenticated load.
- [ ] Each user's per-device import migrates their own v3 backup with zero `listSends` loss (client price history intact).
- [ ] UI is unchanged apart from the accepted deltas (login screen, "Cerrar sesión", import-confirmation copy, `BackupReminder` retirement); all user flows work against Supabase.
- [ ] Dexie dependency removed from `package.json`; no `db` (Dexie) imports remain in `src/`.
- [ ] `verify` (lint, `tsc -b`, `pnpm coverage` at current thresholds) and `e2e` are green.
- [ ] Supabase project upgraded to Pro (or gate explicitly signed off, owner Piwen) before salespeople use it.
