# Exploration: phase-1-supabase-migration

## Current State

`produclist` is a single-package Vite 8 + React 19 + TS 5.8 + Tailwind 4 PWA with **no backend and no auth**. All data lives in IndexedDB through Dexie and is read reactively via `dexie-react-hooks`.

- **Schema** (`src/db/database.ts`, Dexie v4): `products`, `quotes`, `drafts` (single fixed-key autosave row), `listSends`. Numeric auto-increment ids (`++id`).
- **Domain types**: `Product { id?: number, nombre, categoria, formato, precioNeto, disponible }` (`src/types/product.ts`); `QuoteItem { id: string, productId: number, nombre, formato, cantidad, precioKg }` (`src/types/quote.ts`); `SavedQuote { id?: number, fecha, cliente?, items, totalNeto, iva, total }`; `ListSend { id?: number, fecha, cliente, items }` with `ListSendItem { nombre, formato, precioNeto, precioBruto }` (`src/types/listSend.ts`).
- **Data access**: hooks call `db`/CRUD helpers directly (`useProducts` via `useLiveQuery`, `useAddProduct`, `useUpdateProduct`, `useDeleteProduct`, plus `useQuote` autosave). Components `QuoteHistory.tsx` and `ClientPrices.tsx` import `db` and helpers **directly**, not through hooks.
- **Seed**: `src/db/seed.ts` loads 44 products into Dexie on first mount when the table is empty; a per-session dedup runs first.
- **Export/import**: JSON only. `exportBackup` writes `BACKUP_VERSION = 2` with `products` + `quotes`. Import is dry-run-first (`previewImport`) then `applyImport`; products match by name, quotes merge by content signature; v1 bare array still accepted.
- **CI**: `.github/workflows/ci.yml` runs `verify` (lint, `tsc -b`, `pnpm coverage`) and `e2e` (Playwright, Chromium). Unit tests use `fake-indexeddb/auto`; coverage thresholds 60/55/60/60.
- **No traces of Supabase** in `src/` or `package.json`; no `.env`/env handling; `@supabase/supabase-js` is not a dependency.

## Confirmed Blocking Finding

The planning assumption is **correct and verified in code**:

- `src/utils/exportImport.ts` line 15: `export const BACKUP_VERSION = 2;`
- `BackupFile` (lines 21–26) contains only `version`, `exportedAt`, `products`, `quotes`.
- `exportBackup` (lines 54–66) serializes only `products` (passed in) and `db.quotes.toArray()`. **`listSends` is never exported**, and neither `listSends` nor `drafts` is parsed on import (`parseProductImport`, lines 194–237).

Consequence: "last price sent to each client" is derived from `listSends` + `quotes` (`src/utils/clientTracking.ts`, `buildClientPriceHistory`). Migrating with today's v2 export **permanently loses the list-send half of that history**. Export **v3 must ship before any data migration**. (`drafts` is ephemeral single-slot autosave and is correctly out of a backup, but still needs a post-Dexie home.)

## Affected Areas

- `src/utils/exportImport.ts` — v2 → v3 parser/writer; add `listSends` to `BackupFile`, `parseProductImport`, `ImportPreview`, `applyImport`; add a list-send content signature for merge.
- `src/db/database.ts` — the Dexie schema + all CRUD helpers (`addProduct`, `updateProduct`, `deleteProduct`, `deduplicateProducts`, `saveQuote`, `getAllQuotes`, `deleteQuote`, draft helpers, `saveListSend`, `getAllListSends`, `deleteListSend`, `getClientNames`). This is the replacement surface and what gets retired.
- `src/db/seed.ts` — server-side seeding strategy; `deduplicateProducts` uniqueness moves to a Postgres constraint.
- `src/hooks/useProducts.ts` — `useLiveQuery` has no Supabase equivalent; needs a query/subscription strategy while preserving the `Product[] | undefined` contract.
- `src/hooks/useAddProduct.ts`, `useUpdateProduct.ts`, `useDeleteProduct.ts` — point at Supabase; duplicate-name rule becomes a DB constraint + error mapping.
- `src/hooks/useQuote.ts` — `saveQuoteDraft`/`loadQuoteDraft`/`clearQuoteDraft` need a non-Dexie home (see open questions).
- `src/components/QuoteHistory.tsx` — imports `db` and quote helpers directly; must go through the new data layer.
- `src/components/ClientPrices.tsx` — reads `db.listSends` and `db.quotes` directly; must go through the new data layer.
- `src/App.tsx` — composition root: auth gate/provider, seed call, export/import wiring, list-send save. UI markup must not change.
- `src/utils/clientTracking.ts`, `src/utils/listSend.ts`, `src/utils/backupReminder.ts` — pure logic; may stay, but backup-reminder semantics depend on whether local JSON backup is still meaningful.
- `src/types/product.ts`, `src/types/quote.ts`, `src/types/listSend.ts` — id type decision (`number` today) and nullable/`owner_id` additions.
- `README.md` — the "sin backend / datos sólo en IndexedDB" claims become false.
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `.github/workflows/ci.yml`, `src/vite-env.d.ts` — add Supabase client + env typing + CI secrets/test strategy.
- Unit tests: `src/db/__tests__/*`, `src/utils/__tests__/exportImport.test.ts`, `src/hooks/__tests__/*` — currently assume fake-indexeddb; the Supabase boundary must be mockable.
- `e2e/*.spec.ts` — assume an unauthenticated, instant app; auth will change the first interaction and requires a test path.

## Approaches

1. **In-place swap** — rewrite the bodies of `db/database.ts` helpers to call `supabase-js`, keep the same function names/signatures so hooks and components compile unchanged. `useProducts` is reimplemented over a fetch/subscription.
   - Pros: smallest diff, UI genuinely untouched, fastest path to a running app.
   - Cons: every module now imports `db` (a misnomer) and is directly coupled to Supabase; unit tests need the Supabase client mocked globally; `useLiveQuery` reactivity is lost without hand-rolled subscriptions.
   - Effort: Medium.

2. **Data-access layer (repositories + adapter)** — define typed repository interfaces (`ProductsRepo`, `QuotesRepo`, `ListSendsRepo`, `DraftsRepo`), implement them with Supabase, and have hooks/components depend on the interfaces. Components stop importing `db`.
   - Pros: testable with in-memory fakes (keeps `pnpm coverage` meaningful, no vacuous tests); isolates the Dexie→Supabase retirement to one adapter; `useLiveQuery` replaced in one place; supports the import/export layer cleanly.
   - Cons: more files and an upfront interface design; touches hooks and both components that import `db`.
   - Effort: Medium/High.

3. **Dexie as offline cache + Supabase sync** — keep local-first and add two-way sync.
   - Pros: preserves offline behaviour.
   - Cons: contradicts the stated Phase 1 goal (server-first), needs conflict resolution, much larger than 6 work units.
   - Effort: High. Reject for Phase 1.

## Recommendation

Adopt **Approach 2 (data-access layer)**. It is what makes the "retire Dexie without changing the UI" requirement reachable and keeps `verify` honest: unit tests can target in-memory repositories instead of a network client, so we avoid vacuous tests and don't have to weaken coverage thresholds. Sequence the work so **export/import v3 lands as the first work unit** (independently testable against the current Dexie app, before any Supabase code), then the schema + auth + RLS, then the adapter swap, then migration of real data, then CI. Because Phase 1 is six work units on a 400-line review budget, deliver as **chained/stacked PRs** with the `verify` + `e2e` checks green throughout.

`owner_id`: enforce it with a Postgres `DEFAULT auth.uid()` plus `NOT NULL` (in addition to setting it explicitly on insert) so a forgotten insert cannot create an ownerless row. RLS policy = authenticated read-all/write-all for the 5 equal-privilege profiles.

## Risks

- **Data-loss risk if export v3 slips**: migrating with v2 silently drops all `listSends`. This is the single highest-severity risk; gate migration on v3.
- **`owner_id` from the first insert**: rows created before the column/RLS exist cannot be back-filled reliably; the schema must ship with the column and default before any real insert.
- **Offline regression**: the app is currently offline-capable; server-first is not. There is no offline UX in the current UI, and adding one is out of scope — salespeople may hit silent failures. Needs an explicit product decision.
- **CI impact**: `verify` and `e2e` run with no Supabase credentials. Unit tests must not require a live project; e2e needs either a seeded test project + secrets or a mock/stub auth path. Also watch the **400-line budget**: a naive "touch everything" swap will blow it.
- **ID type mismatch**: types and UI use numeric ids (`productId: number`, `id?: number`); Supabase commonly uses uuid. Switching to uuid ripples through `QuoteItem.productId`, `Product.id`, and component keys.
- **Concurrency / last-write-wins**: five users "see all" but there is no conflict handling; simultaneous edits to the same product or quote will clobber. Not in scope, but must be acknowledged.
- **Supabase Free constraints**: no automatic backups and project pause after ~1 week idle; Free is dev/migration only, with a gate to Pro before real use.
- **Backup-reminder semantics**: `BackupReminder` exists because data was local-only; with server data its rationale weakens and its tests/behaviour may need redefinition.

## Open Questions

1. **ID strategy**: keep numeric ids (Postgres `bigint identity`) to preserve `number` types and minimise UI churn, or move to uuid and accept the type ripples?
2. **Existing device data**: on first login, does each device run a one-time local Dexie → Supabase import, or is there a single canonical migration from one device's v3 backup?
3. **`drafts` autosave**: keep it browser-local (localStorage/sessionStorage) or move to Supabase? Requirement 5 says retire Dexie; a server draft is a different feature.
4. **Authorisation UX for the 5 named users**: how do the accounts get created/confirmed (dashboard vs signup), and is self-signup disabled?
5. **Seeding**: seed the 44 products once server-side (SQL migration) or via the app on first run? Which `owner_id` owns the shared catalog?
6. **E2E strategy in CI**: real test Supabase project with secrets, or a mocked auth/data layer for Playwright?
7. **Does export/import survive auth?** If every authenticated user sees all rows, what does "import" mean — server-side merge? Is the local JSON backup still a product feature?
8. **Offline expectation for salespeople**: is an offline/failure banner acceptable in Phase 1, or must offline behaviour be preserved?

## Ready for Proposal

**Yes** — the current state and the blocking v2→v3 gap are verified in code, affected areas are identified, and an approach with a sequencing recommendation is proposed. The orchestrator should tell the user: the blocking export-v3 finding is real (v2 writes only `products` + `quotes`), export v3 must precede migration, and the open questions above need answers before spec/design — especially ID strategy, per-device vs single-run data migration, and the CI/e2e test strategy.
