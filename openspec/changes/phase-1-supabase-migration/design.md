# Design: Phase 1 — Supabase Migration (Server-First, Private Per User)

## Technical Approach

Move `produclist` from local-first Dexie/IndexedDB to Supabase (Postgres + Auth +
RLS) **without touching the UI flows** beyond the accepted deltas (login screen,
"Cerrar sesión" menu item, import-confirmation copy, `BackupReminder`
retirement). The data model is **private per user**: `productos`, `cotizaciones`
(+ items) and `listas_enviadas` (+ items) belong to one owner; each vendor keeps
their own list and their own prices. The admin (`admin@example.com`) gets
a **read-only global view** through RLS; writes are owner-only in every case. The
previous shared-catalog premise is reversed, and the `updated_at` cross-user
conflict item is dropped entirely — with private rows there is exactly one writer
per row.

The change uses exploration **Approach 2**: a typed repository/data-access layer
(ports and adapters) sits between hooks/components and the backend. Components
and hooks stop importing Dexie and depend on interfaces; a Supabase adapter
implements them, and in-memory fakes implement them for unit tests and for the
Playwright stub path. Dexie is retired only after every call site is port-based.

Hard ordering from the proposal is preserved: **backup v3 ships first against the
current Dexie app** (v2 drops `listSends`), then schema + auth + RLS + adapters,
then the per-device real-data migration, then CI hardening.

Capability mapping:

| Proposal capability | Settled by |
|---|---|
| `supabase-schema` | Decisions 1, 2, 3, 4, 6, 7; Schema / RLS block |
| `supabase-auth` | Decisions 3, 8; Auth ports block |
| `supabase-data-access` | Decisions 2, 5, 9, 13; Repository contracts block |
| `backup-v3` | Decisions 10, 11, 12; v3 format block |

Delivery is a feature-branch chain: slice 1 (backup v3) merges to `master`
immediately; slices 2–6 stack on a tracker branch and merge to `master` only at
the cutover. Until the cutover deploy, users keep running today's Dexie build
plus v3 export.

## Architecture Decisions

### Decision 1: Primary keys stay numeric (`bigint identity`)

**Choice**: Postgres `id bigint generated always as identity primary key` on
`productos`, `cotizaciones`, `listas_enviadas`. Domain types keep
`id?: number` / `productId: number`; the new ownership column is `owner_id uuid`
(auth users are uuid; the two concerns are independent).
**Alternatives considered**: `uuid` primary keys (Supabase default in many
templates).
**Rationale**: Today the whole codebase, tests, and UI keys use `number`
(`Product.id?: number`, `QuoteItem.productId: number`, `key={product.id}`).
`uuid` would ripple through types, test fixtures, component keys, and the backup
format for zero Phase-1 benefit. PostgREST returns `bigint` as a JSON number and
identity values stay far below 2^53, so no precision risk. File ids from a
backup are never trusted: import always lets the server assign ids (Decision 10).
`productId` inside `QuoteItem` is documented as historical snapshot metadata —
it is written on add and never read for lookups (verified in code), so it does
not need to resolve against `productos.id` after migration.

### Decision 2: Private-per-user ownership enforced by RLS; reads are RLS-driven

**Choice**: every data table carries `owner_id uuid not null default auth.uid()
references auth.users (id)`. The access matrix is:

| Action | Vendor | Admin |
|---|---|---|
| SELECT own rows | Yes | Yes |
| SELECT other users' rows | No (RLS filters) | **Yes — global read view** |
| INSERT own rows | Yes | Yes |
| UPDATE / DELETE own rows | Yes | Yes |
| UPDATE / DELETE other users' rows | No | No (read-only in practice) |

- Application reads **do not add a client-side owner filter**. The RLS-visible
  set *is* the result: for a vendor that is exactly `owner_id = self`; for the
  admin it expands to every owner (the supervision view the proposal requires,
  including the union of client names in `ClientPrices`). `listOwn()` exists for
  the paths that must always be owner-scoped (seed, import, export).
- Application writes always target the session user's rows and set
  `owner_id = self` on insert (the column default is the second line of defense).
- Postgres RLS filters foreign rows out of `UPDATE`/`DELETE` **silently**: the
  statement affects 0 rows and PostgREST returns no error. Adapters therefore
  request the affected row back (`.select('id')`) and map "0 rows affected" to a
  user-safe ownership error instead of a false success.
- Backups are always owner-scoped (`listOwn`): the admin's global view is for
  supervision and is never folded into his own export.
- No optimistic-locking / `updated_at` conflict handling: private rows have a
  single writer, so cross-user conflicts cannot exist (the proposal drops this
  item entirely).
- Accepted Phase-1 consequences (UI unchanged): the admin's lists show one row
  per owner, so the same product name repeated across vendors appears multiple
  times; editing/deleting a foreign row surfaces the ownership error; the
  admin's PDF and "Guardar lista enviada" build from the global product list.

**Alternatives considered**: (a) shared catalog (the reversed premise) — it
would discard four of five devices' local work and their prices; (b) client-side
`.eq('owner_id', userId)` everywhere — hides the admin's global view and
duplicates the security rule in the client while RLS remains the boundary;
(c) admin write-all policies — contradicts the confirmed decision that the
admin's global view is read-only; (d) separate admin screens — new UI, out of
scope.
**Rationale**: RLS is the single enforcement point; private-by-default reads and
owner-only writes come from the database, not from application discipline. The
admin capability is additive, driven by `perfiles.rol` (Decision 3), and every
row is attributed from its first insert (`NOT NULL DEFAULT auth.uid()`).

### Decision 3: `is_admin()` is a non-recursive `SECURITY DEFINER` helper

**Choice**: `perfiles` gains `rol text not null default 'vendedor' check (rol in
('admin','vendedor'))`. The admin check is a pinned, `SECURITY DEFINER` SQL
function:

```sql
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
```

- **Why `SECURITY DEFINER` + `set search_path = ''`**: the `perfiles` SELECT
  policy itself calls `is_admin()`; if the helper read `perfiles` as the invoker
  (default `SECURITY INVOKER`), that read would re-enter the `perfiles` policy
  and Postgres would abort every query with `42P17: infinite recursion detected
  in policy for relation "perfiles"` — and because the other tables' policies
  also call `is_admin()`, all reads would break. Running as the function owner
  (the table owner, exempt from its own RLS) breaks the cycle. The pinned empty
  `search_path` plus fully qualified `public.perfiles` prevents search-path
  hijacking of a definer function; `stable` lets the planner evaluate it once
  per statement.
- Policies call `public.is_admin((select auth.uid()))`; the `uid` parameter
  exists so the function is directly testable with a literal uuid.
- Do **not** enable `FORCE ROW LEVEL SECURITY` on `public.perfiles` later: it
  would re-introduce the recursion by subjecting the definer's read to RLS.
- `perfiles` SELECT policy: `id = (select auth.uid()) or
  public.is_admin((select auth.uid()))`. No authenticated INSERT/UPDATE/DELETE
  policies there: rows are created by the provisioning trigger (definer) and
  roles are changed from the dashboard/SQL only.

**Alternatives considered**: (a) inline `exists (select 1 from perfiles …)`
inside each policy — recursion; (b) role via JWT custom claims (custom
access-token hook) — heavier Auth configuration, claim staleness, and no
Phase-1 benefit for a 5-row table; (c) denormalized `is_admin` boolean on data
rows — goes stale on role change and the role becomes data duplication.
**Rationale**: a small, auditable helper evaluated inside the database; no
application code branches on the role, so the UI stays unchanged and the
capability remains a pure data-layer concern.

### Decision 4: Per-user uniqueness `(owner_id, nombre)` replaces the global name index

**Choice**: `create unique index productos_owner_nombre_key on
public.productos (owner_id, nombre);`. The old global `productos_nombre_key` is
gone, as is the Dexie `deduplicateProducts` session pass.
**Alternatives considered**: keep a global unique name (contradicts the model: a
vendor must be able to own `ALMENDRA LAMINADA` with their own price); case
insensitive `citext` uniqueness (legitimate name differences become impossible;
not needed to satisfy the per-user rule).
**Rationale**: two vendors owning the same product name with different prices is
the model, not a conflict. Within one user's rows the constraint still prevents
the duplicates `deduplicateProducts` used to clean up, so that helper and its
session flag are retired. The adapter maps `error.code === '23505'` to the
existing Spanish message (`Ya existe un producto llamado "<nombre>"`), preserving
today's UX. Matching is exact (same as Dexie today), on `(owner_id, nombre)`.

### Decision 5: Repository ports + adapters; fakes are shared with the e2e stub

**Choice**: `src/data/ports.ts` defines `ProductsRepo`, `QuotesRepo`,
`ListSendsRepo`, `ClientsRepo`, `DraftsRepo`, `Repositories`. Supabase
implementations live in `src/data/supabase/*` and are constructed per
authenticated session with `(client, userId)`; in-memory implementations live in
`src/data/testing/inMemoryRepos.ts` and are used by unit tests **and** by the
Playwright stub bootstrap. Components/hooks receive them through
`DataProvider`/`useData()`. Each repo exposes two read scopes: `list()` =
RLS-visible set (vendor: own; admin: all) and `listOwn()` = `owner_id = session
user` (seed, import, export). Writes target own rows and reject 0-row results
with the mapped ownership error (Decision 2). The fakes mirror the same contract
(`createInMemoryRepositories({ userId, isAdmin })`), so both privacy and the
admin's global view are unit-testable without a database.
**Alternatives considered**: (a) in-place swap rewriting `db/database.ts` bodies
to call supabase-js — smallest diff, but unit tests would need a globally mocked
network client and coverage becomes vacuous; (b) keeping a Dexie adapter behind
the ports for a dual-mode build flag — rejected: the tracker branch is not
deployed until cutover, so the Dexie adapter would be dead code (Dexie remains
in the tree only until slice 6 deletes it).
**Rationale**: fakes keep `pnpm coverage` meaningful (60/55/60/60) with no
network, isolate the Supabase dependency to adapters that are unit-tested with a
stub client, and give Playwright a deterministic backend. The
`@supabase/supabase-js` client is constructed once in
`src/data/supabase/client.ts` and injected into adapters, so tests never need a
live project.

### Decision 6: `items` are `jsonb` snapshots; no child item tables

**Choice**: `cotizaciones.items jsonb`, `listas_enviadas.items jsonb`, storing
the existing `QuoteItem[]` / `ListSendItem[]` shapes verbatim. The proposal's
"(+ items)" is satisfied inside the parent row.
**Alternatives considered**: normalized `cotizacion_items` /
`lista_enviada_items` child tables (more idiomatic SQL, enables item-level
queries).
**Rationale**: items are *snapshots* by design (`ListSend` docs, quote history
display, `clientTracking`), never joined to the catalog, and the pivot does not
change that. Domain types embed arrays and export/import serializes them
embedded. `jsonb` preserves the shape with zero mapping risk, a single round
trip, and no multi-statement transaction (supabase-js has no multi-table
transaction). Normalization buys nothing until a feature needs item-level SQL
(e.g. Metabase/reporting, which is explicitly out of scope) and can be added
later by migration.

### Decision 7: Seed the 44 base products per user on first authenticated load

**Choice**: keep the 44-product array as a TS constant (moved to
`src/data/seedProducts.ts` in slice 6) and have `DataProvider` call
`products.seedIfEmpty(seedProducts)` once per authenticated session. The
adapter:

```ts
// src/data/supabase/productsRepo.ts — owner-scoped seed
async seedIfEmpty(seed: ProductInput[]): Promise<void> {
  // Admin trap: an un-scoped count() sees EVERYONE's rows through RLS and would
  // wrongly skip the admin's own seed. The guard MUST filter by owner_id.
  const { count } = await client
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if ((count ?? 0) > 0) return;

  const { error } = await client.from('productos').upsert(
    seed.map((p) => ({ ...toProductRow(p), owner_id: userId })),
    { onConflict: 'owner_id,nombre', ignoreDuplicates: true }, // was: 'nombre' globally
  );
  if (error) throw mapPostgrestError(error);
}
```

**Alternatives considered**: (a) SQL seed migration inserting the 44 rows and
resolving `owner_id` from the admin's `auth.users` row — duplicates the product
list in SQL, requires admin provisioning before the seed migration, breaks local
dev resets, and cannot run per user by construction; (b) a `seeded_at` flag on
`perfiles` — extra state to keep in sync for a count query that is already
cheap.
**Rationale**: single source of truth for the base list (the same constant seeds
the e2e stub), environment-agnostic (works against a fresh dev project and each
new user), and preserves today's "empty list ⇒ seed on load" behavior per user.
Every seeded row is owned by the user who triggered it: the old "first seeder
owns the catalog as provenance" rationale is dead because there is no shared
catalog anymore. `ignoreDuplicates` makes StrictMode double-mounts, two tabs, and
repeated logins idempotent: each user ends up with exactly 44 owned rows. The
owner-scoped count means a reload after deliberately deleting all products
re-seeds (same parity as today's `count === 0` behavior).

### Decision 8: Auth provisioning via dashboard + `perfiles` trigger; `rol` set server-side

**Choice**: create the 5 users in the Supabase dashboard (Auth → Users → Add
user, "Auto Confirm User" ON) with manual passwords communicated out-of-band.
Disable "Allow new users to sign up" (Auth → Sign In / Providers → Email).
`perfiles` is populated by an `after insert on auth.users` trigger (`security
definer`, `set search_path = ''`) using `raw_user_meta_data->>'nombre'` with an
email-derived fallback, and **always** inserts `rol = 'vendedor'`. After the
accounts exist, one documented idempotent statement promotes the admin:

```sql
update public.perfiles set rol = 'admin' where email = 'admin@example.com';
```

Accounts: `admin@` (admin); `vendedor1@`, `vendedor2@`, `vendedor3@`,
`vendedor4@` (vendedores). The admin runs one documented `UPDATE` for the 5
display names. No signup UI, no password reset UI in Phase 1 — resets are done
from the dashboard.
**Alternatives considered**: a service-role Admin API script
(`auth.admin.createUser`) — reproducible, but requires handling a service-role
key for a one-time, five-row operation; SQL inserts into `auth.users` — not
supported/recommended; taking `rol` from `raw_user_meta_data` — would make role
assignment user-controlled, a privilege-escalation path even with signup
disabled.
**Rationale**: five manual actions, no secret handling, and reproducibility is
documented in the README for the prod project. `perfiles.id` (FK to
`auth.users.id`) *is* the owner key for profiles; a separate `owner_id` column
there would be redundant.

### Decision 9: Drafts live in `localStorage` behind `DraftsRepo`

**Choice**: `createLocalStorageDraftsRepo()` with key `produclist:quoteDraft`,
shape `{ items, totalNeto, iva, total }`; `DraftsRepo.load/save/clear` are async
wrappers so `useQuote` call sites barely change.
**Alternatives considered**: a server `borradores` table (cross-device draft) —
a new feature with last-write-wins weirdness; keeping Dexie just for drafts —
defeats retirement.
**Rationale**: the draft is an ephemeral, single-slot, per-device autosave that
is deliberately excluded from backups. Its home was confirmed as
browser-local. It also keeps an in-progress quote surviving a refresh even when
the network is down.

### Decision 10: Import/export under private-per-user: owner-scoped, additive, idempotent

**Choice**:
- Export walks `listOwn()` for products, quotes and list sends: a backup is
  always exactly one user's partition, even for the admin. v3 adds `listSends`
  to the file (Decision 12).
- Import is **additive/update-only into the importing user's own partition**; it
  never deletes rows and never touches another owner's rows.
- Products match by exact `nombre` **among the user's own products only**
  (`listOwn()`): update the own existing row or insert a new one with
  `owner_id = self`. The DB unique index (Decision 4) plus the adapter's `23505`
  mapping replaces `deduplicateProducts` and the name pre-checks. Using the
  global RLS-visible set instead would make the admin's import try to "update"
  other vendors' rows and report false results.
- Quotes keep today's content signature (`fecha` ISO + items + `total`;
  `cliente` stays out of the signature, preserving current merge behavior).
- New in v3: list sends merge by content signature
  (`fecha` ISO + `cliente.trim().toLowerCase()` + items `{nombre, formato,
  precioNeto, precioBruto}`) among the user's own rows.
- Incoming file ids are ignored; the server assigns ids. `QuoteItem.productId`
  values from old Dexie data may not match server product ids — documented as
  historical metadata (Decision 1).
- Re-importing the same file is a no-op, which is what makes per-device
  migration (Decision 11) and "did I already import?" safe.
**Alternatives considered**: shared-state merge where every user's import lands
in one visible pool — reversed with the pivot; delete-and-replace import —
destructive and unnecessary; id-based matching — fails across devices.
**Rationale**: identical dry-run-then-apply UX; each user's file only shapes
their own data; no data destruction path from a stale or repeated file.

### Decision 11: Real-data migration is per device

**Choice**: each user, on first login on their device, imports **their own v3
backup** through the app's existing Import UI; every imported row gets
`owner_id = the logged-in user`. There is **no single canonical run** from one
designated device. Operational sequence: every user exports their v3 file from
the Dexie build immediately before the cutover deploy (the PWA auto-updates, so
this window is the migration source), then after the cutover deploy each user
signs in on their own device, gets their per-user seed, and imports their own
file.
**Alternatives considered**: (a) one canonical v3 file imported by the admin —
reversed by the confirmed decision: it would place four vendors' data under the
admin's ownership and lose their private partitions; (b) a per-device automatic
Dexie→Supabase push inside the new build — requires keeping Dexie read code in
the cutover build and five coordinated runs, larger than the Phase-1 budget;
(c) a SQL/Node migration script — a new untested code path and service-role
handling.
**Rationale**: reuses the tested import path end-to-end (parse → preview →
apply → repos) once per user, keeps `owner_id` correct automatically
(`auth.uid()` of the importing user), and needs no cross-user reconciliation:
signature merge plus owner scoping makes re-imports and accidental double-runs
harmless. The cost is operational discipline (export-before-cutover per device),
which is called out in Migration / Rollout.

### Decision 12: Retire `BackupReminder`; keep manual v3 export

**Choice**: delete `src/components/BackupReminder.tsx`,
`src/utils/backupReminder.ts`, their tests, the `markBackedUp()` call in
`exportBackup`, and the `<BackupReminder>` render in `App.tsx` (slice 6). The
Export menu item stays.
**Alternatives considered**: rewording the reminder to "Free tier has no server
backups" — rejected: the message would be wrong again after the Pro upgrade and
it nags every device for a team-wide snapshot; keeping it unchanged — rejected:
its claim ("if the browser is cleared or you change phones, it's lost") becomes
false the moment data is server-side.
**Rationale**: the reminder's premise disappears with server-first data; Pro
(the go-live gate) provides platform backups. This is a deliberate, minimal
removal of a now-false affordance, not a redesign; README documents that manual
v3 exports remain the recovery path until the project is on Pro.

### Decision 13: Offline/failure behavior and refresh model (no offline UX)

**Choice**:
- No cache, no offline banner, no write queue. Every repo call rejects on
  failure; call sites keep their existing behavior: mutations surface the
  existing `toast.error` messages, component-level loads keep their current
  `console.error` / loading fallbacks.
- `useProducts` keeps the `Product[] | undefined` contract. `undefined` means
  "not loaded yet": on first-load failure it logs and stays `undefined`, so
  `ProductList` shows its existing "Cargando productos..." skeleton rather than
  a misleading empty list.
- `DataProvider` refreshes the products cache on mount (once; StrictMode-safe),
  on `visibilitychange → visible`, on `window.online`, and after every mutation.
- **No Supabase Realtime in Phase 1.** The admin's global view updates on
  refocus/reload, not live; other users' new rows appear the same way.
- RLS denial is not an offline error: it is the mapped ownership error of
  Decision 2.
**Alternatives considered**: Realtime `postgres_changes` subscription (live
updates for the admin view) — rejected for Phase 1: it adds channel lifecycle,
RLS-on-realtime surface, and test complexity beyond the 400-line budget; revisit
if users ask.
**Rationale**: matches the accepted trade-off in the proposal while giving
failure behavior that is defined and honest.

### Decision 14: CI/e2e use fakes and a stub bootstrap — no Supabase secrets, no new CI job

**Choice**:
- **Unit (`pnpm coverage`)**: in-memory fake repos (no `fake-indexeddb`);
  Supabase adapters tested against a hand-rolled stub of the client's `from()`
  chain, covering query shape (owner filters, `list` vs `listOwn`), row→domain
  mapping, Date conversion, `23505` → Spanish duplicate message, and 0-row
  update/delete → ownership error. The fakes mirror the RLS-visible contract
  (`{ userId, isAdmin }`) so privacy and the admin's global view are covered
  without a database. Auth gate and `LoginScreen` tested with a fake `AuthPort`.
- **E2E (Playwright)**: `playwright.config.ts` sets `webServer.env: { VITE_E2E: '1' }`.
  In stub mode the app boots fake auth (authenticated by default; a spec can set
  `localStorage['e2e:auth'] = 'off'` before load to assert the gate) and
  in-memory repos pre-seeded with `seedProducts`. Existing responsive/diagnose
  specs keep their assertions.
- **`.github/workflows/ci.yml`**: unchanged. `verify` keeps lint + `tsc -b` +
  `pnpm coverage`; `e2e` keeps `pnpm exec playwright test`, now deterministic and
  credential-free.
- **RLS itself is not exercisable through fakes**: the security matrix is
  verified in the manual dev-project checklist (Testing Strategy / Migration),
  not in CI, because no Supabase credentials exist and the Free project pauses.
**Alternatives considered**: (a) seeded test project + GitHub secrets + live
Playwright login — rejected: no credentials exist, Free projects pause, PRs from
forks get no secrets, and e2e would test network flakiness; (b) Playwright
`page.route` interception of PostgREST/Auth HTTP — rejected: brittle
re-implementation of PostgREST semantics for a suite that only asserts layout;
(c) `supabase start` (Docker) in CI — viable later, rejected now for
runtime/flakiness cost.
**Rationale**: keeps both required jobs green and credential-free, keeps unit
coverage honest, and confines "does it really talk to Supabase, and do the RLS
policies hold" to a short manual checklist plus the migration itself.

### Decision 15: Delivery = feature-branch chain with a single cutover merge

**Choice**: slice 1 merges to `master` immediately (works against Dexie, ships
independent value). Slices 2–6 are stacked PRs on a tracker branch; the tracker
merges to `master` once, at cutover. Each slice keeps `verify` + `e2e` green.
Slice 6 (Dexie removal) is part of the tracker, so the cutover build has no
Dexie at all. Rollback = redeploy the previous `master` build (which still
contains Dexie) and have each user re-import their latest v3 file into their
device; data written to Supabase after cutover is not carried back.
`master` is protected: all work lands through PRs; Vercel auto-deploys on merge
to `master`.
**Alternatives considered**: (a) shipping slices 3–5 to prod progressively —
rejected: users would see a login gate with an empty per-user workspace for
days; (b) a build-time `VITE_DATA_BACKEND=dexie|supabase` flag with a Dexie
adapter behind the ports for instant flip-back — rejected for Phase 1: it keeps
a short-lived adapter and dual wiring for a rollback path already covered by
"redeploy previous build + v3 re-import".
**Rationale**: users are never stranded mid-migration; the review budget is
respected via chained slices; rollback is a deploy, not a code change.

## Data Flow

**Boot / auth gate** (`src/Root.tsx`):

    main.tsx
      ├─ VITE_E2E=1 ─→ dynamic import(data/testing/stub) ─→ fake AuthPort + fake Repos
      └─ else       ─→ supabase client (env) ─────────────→ SupabaseAuth + Supabase Repos
                                                                    │
    Root ── AuthProvider ── status ── loading ──→ minimal spinner
                              │        unauthenticated ─→ LoginScreen (email/password)
                              │        authenticated ───→ DataProvider ─→ App
                              └─ signOut() in App hamburger menu ──────→ LoginScreen

**Read/write path** (every existing flow):

    Component ──→ hook (useProducts / useAddProduct / …)
        │             │
        │             └─ ProductsCache (useSyncExternalStore snapshot)
        │                    │  refresh on mount / focus / online / after mutation
        └────────────→ Repositories (ports, constructed with session userId)
                             └──→ Supabase adapter ──→ supabase-js ──→ PostgREST
                                      SELECT: RLS owner_id = auth.uid() OR is_admin(auth.uid())
                                        vendor → own rows · admin → all rows (read-only supervision)
                                      INSERT/UPDATE/DELETE: RLS owner_id = auth.uid()
                                        foreign row → 0 rows → mapped ownership error

**Import/export path** (v3, owner-scoped):

    exportBackup(repos) → listOwn() products + quotes + listSends → JSON v3 file
    file → parseProductImport (pure) → previewImport(repos)  [no writes; listOwn matching]
         → ConfirmDialog (user) → applyImport(repos)
              ├─ products:  update own by (owner_id = me, nombre) | insert (owner_id = me)
              ├─ quotes:    insert when signature unseen among my rows
              └─ listSends: insert when signature unseen among my rows

**Per-device migration** (operational, not code):

    [Dexie build + v3 export] every user exports their own v3 JSON → freeze data entry
        → cutover deploy → each user signs in on their own device
        → seedIfEmpty (44 products owned by that user)
        → each user imports their own v3 file → owner-scoped merge
        → verify counts per owner + ClientPrices spot-check (+ admin global view check)

## File Changes

Slices are the delivery units; sdd-tasks must forecast each slice against the
400-line budget and split further if needed.

### Slice 1 — `backup-v3` (targets `master`, Dexie-era)

| File | Action | Description |
|------|--------|-------------|
| `src/utils/exportImport.ts` | Modify | `BACKUP_VERSION = 3`; add `listSends` to `BackupFile`, `exportBackup`, `parseProductImport`, `ImportPreview` (`listSendsToAdd`), `applyImport` (`listSendsAdded`); add `listSendSignature` |
| `src/utils/__tests__/exportImport.test.ts` | Modify | v3 round-trip parse/preview/apply, v1/v2 compatibility, list-send signature merge |
| `src/App.tsx` | Modify | Import confirmation/summary copy also reports list-send counts (minimal copy delta) |

### Slice 2 — `supabase-schema` (tracker)

| File | Action | Description |
|------|--------|-------------|
| `supabase/config.toml` | Create | Minimal CLI config for `supabase link` / `db push` |
| `supabase/migrations/20261005000000_init.sql` | Create | Tables with `owner_id` + `perfiles.rol`, `is_admin()` SECURITY DEFINER helper, RLS (owner-or-admin read, owner-only write), unique index `(owner_id, nombre)`, `(owner_id, fecha desc)` indexes, `handle_new_user` trigger, grants (see Schema / RLS block) |

### Slice 3 — `supabase-auth` (tracker)

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml` | Modify | Add `@supabase/supabase-js` |
| `src/vite-env.d.ts` | Modify | `ImportMetaEnv`: `VITE_SUPABASE_URL?`, `VITE_SUPABASE_ANON_KEY?`, `VITE_E2E?` |
| `src/data/supabase/client.ts` | Create | Env read, `createClient`, `assertSupabaseConfig()` |
| `src/auth/ports.ts` | Create | `AuthPort`, `AuthSession` |
| `src/auth/supabaseAuth.ts` | Create | `signInWithPassword` / `getSession` / `onAuthStateChange` / `signOut` adapter |
| `src/auth/AuthProvider.tsx`, `useAuth.ts` | Create | Session state machine + context |
| `src/auth/LoginScreen.tsx` | Create | Email/password form; Spanish copy; generic invalid-credentials error |
| `src/auth/testing/fakeAuth.ts` | Create | Fake port for unit tests; `e2e:auth` switch for Playwright |
| `src/types/profile.ts` | Create | `ProfileRole = 'admin' \| 'vendedor'`; `Profile { id, email, nombre, rol }` |
| `src/Root.tsx` | Create | Composition root: providers + auth gate |
| `src/main.tsx` | Modify | Boot service container (supabase or stub) and render `Root` |
| `src/App.tsx` | Modify | "Cerrar sesión" item in the existing hamburger menu (auth-gate UI) |
| `playwright.config.ts` | Modify | `webServer.env: { VITE_E2E: '1' }` |
| `e2e/auth.spec.ts` | Create | Gate: unauthenticated shows login; sign-in reveals the app |

### Slice 4 — `data-access-products` (tracker)

| File | Action | Description |
|------|--------|-------------|
| `src/data/ports.ts` | Create | Repository interfaces (incl. `list` vs `listOwn`), input types, ownership-error contract |
| `src/data/supabase/rows.ts`, `mappers.ts` | Create | Row types (`snake_case`, `owner_id`), row↔domain mapping, Date conversion, PostgREST error mapping (`23505`, 0-row ownership error) |
| `src/data/supabase/productsRepo.ts` | Create | `ProductsRepo` over supabase-js (injected client + session `userId`): RLS-visible `list`, owner-scoped `listOwn`, per-user `seedIfEmpty`, 0-row checks on update/remove |
| `src/data/ProductsCache.ts` | Create | `useSyncExternalStore`-friendly cache |
| `src/data/DataProvider.tsx`, `useData.ts` | Create | Context with repos + cache; refresh triggers; per-user seed call on auth |
| `src/data/local/draftsRepo.ts` | Create | `localStorage` implementation of `DraftsRepo` |
| `src/data/testing/inMemoryRepos.ts`, `stub.ts` | Create | Fakes mirroring the RLS-visible contract (`{ userId, isAdmin }`) + stub service container (seeded with `seedProducts`) |
| `src/hooks/useProducts.ts` | Modify | Cache-backed, keeps `Product[] \| undefined`; serves the RLS-visible set (vendor own / admin all) |
| `src/hooks/useAddProduct.ts`, `useUpdateProduct.ts`, `useDeleteProduct.ts` | Modify | Use `ProductsRepo` via `useData()` |
| `src/hooks/useQuote.ts` | Modify | Drafts via `DraftsRepo` |
| `src/components/QuoteProductSelector.tsx` | Modify | Drop `useLiveQuery`/`db`; use `useProducts` |
| `src/pdf/ProductPDFDocument.tsx` | Modify | Remove `useLiveQuery`/`db`; require `products` prop (react-pdf renders in its own root, so app context is not available) |
| `src/components/PDFButton.tsx` | Modify | Read `useProducts()` in the app tree and pass `products` into the document |
| `src/App.tsx` | Modify | Pass products to `PDFButton` |
| `src/hooks/__tests__/useQuote.test.tsx`, `src/components/__tests__/*` | Modify | Render with `DataProvider` + fakes |
| `vitest.config.ts` | Modify | Exclude `src/data/testing/**` from coverage |

### Slice 5 — `data-access-quotes-lists` (tracker)

| File | Action | Description |
|------|--------|-------------|
| `src/data/supabase/quotesRepo.ts`, `listSendsRepo.ts`, `clientsRepo.ts` | Create | Remaining adapters: RLS-visible `list` / owner-scoped `listOwn`, 0-row ownership checks on remove |
| `src/utils/clientNames.ts` | Create | Pure `mergeClientNames(quotes, sends)` extracted from `getClientNames` (admin sees the union of all owners) |
| `src/types/quote.ts` | Modify | Move `SavedQuote`, `QuoteDraft`, `DRAFT_KEY` here; add optional `ownerId`; document `productId` as snapshot metadata |
| `src/types/product.ts`, `src/types/listSend.ts` | Modify | Add optional `ownerId: string` (camelCase domain field for `owner_id`) |
| `src/utils/clientTracking.ts` | Modify | Import `SavedQuote` from `src/types/quote.ts` |
| `src/utils/exportImport.ts` | Modify | `createBackupService(repos)`: export reads `listOwn()`, preview/apply match against `listOwn()` |
| `src/components/Cotizador.tsx` | Modify | `saveQuote` and client names via repos |
| `src/components/QuoteHistory.tsx` | Modify | `list`/`remove` via repos; stop importing `db` |
| `src/components/ClientPrices.tsx` | Modify | Stop importing `db`; read list sends/quotes via repos |
| `src/App.tsx` | Modify | Backup service + list-send repo + client names via ports |
| `src/utils/__tests__/exportImport.test.ts` | Modify | Switch to fakes + service factory; owner-scoped matching cases |

### Slice 6 — `retire-dexie` (tracker, cutover build)

| File | Action | Description |
|------|--------|-------------|
| `src/db/database.ts` | Delete | Dexie schema + all helpers retired |
| `src/db/seed.ts` | Delete | `seedDatabase` retired; `seedProducts` moves |
| `src/data/seedProducts.ts` | Create | The 44-product constant (single source for seed + stub) |
| `src/data/ports.ts`, `src/data/supabase/productsRepo.ts`, `src/data/DataProvider.tsx` | Modify | `seedIfEmpty()` per-user wiring on authenticated first load |
| `src/components/BackupReminder.tsx`, `src/utils/backupReminder.ts` | Delete | Retired (Decision 12) |
| `src/components/__tests__/BackupReminder.test.tsx`, `src/utils/__tests__/backupReminder.test.ts`, `src/db/__tests__/*` | Delete | Tests for retired surface |
| `src/utils/exportImport.ts` | Modify | Drop `markBackedUp()` |
| `src/test-setup.ts` | Modify | Drop `fake-indexeddb/auto` |
| `package.json`, `pnpm-lock.yaml` | Modify | Remove `dexie`, `dexie-react-hooks`, `fake-indexeddb` |
| `README.md` | Modify | Server-first docs: setup, env, migrations, account provisioning + admin `rol` UPDATE, per-device migration procedure, Free→Pro gate |

## Interfaces / Contracts

### Repository ports (`src/data/ports.ts`)

```ts
import type { Product, ProductInput } from '../types/product';
import type { SavedQuote, QuoteDraft } from '../types/quote';
import type { ListSend } from '../types/listSend';

export interface ProductsRepo {
  /** RLS-visible set: own rows; the admin also sees every other owner's rows. */
  list(): Promise<Product[]>;
  /** Always owner-scoped to the session user: seed guard, import/export matching. */
  listOwn(): Promise<Product[]>;
  create(input: ProductInput): Promise<Product>;
  /** Rejects when RLS filters the target row away (0 rows affected). */
  update(id: number, changes: Partial<ProductInput>): Promise<void>;
  /** Rejects when RLS filters the target row away (0 rows affected). */
  remove(id: number): Promise<void>;
  /** Owner-scoped count; upsert on (owner_id, nombre) with ignoreDuplicates. */
  seedIfEmpty(seed: ProductInput[]): Promise<void>;
}

export type QuoteInput = Omit<SavedQuote, 'id' | 'fecha'> & { fecha?: Date };

export interface QuotesRepo {
  list(): Promise<SavedQuote[]>;        // RLS-visible, fecha desc
  listOwn(): Promise<SavedQuote[]>;     // session user only, fecha desc
  create(data: QuoteInput): Promise<SavedQuote>;
  remove(id: number): Promise<void>;    // 0 rows → ownership error
}

export interface ListSendsRepo {
  list(): Promise<ListSend[]>;          // RLS-visible, fecha desc
  listOwn(): Promise<ListSend[]>;       // session user only, fecha desc
  create(data: Omit<ListSend, 'id' | 'fecha'> & { fecha?: Date }): Promise<ListSend>;
  remove(id: number): Promise<void>;    // 0 rows → ownership error
}

export interface ClientsRepo {
  /** Merge over the RLS-visible quotes + sends; the admin sees the union. */
  listNames(): Promise<string[]>;
}

export interface DraftsRepo {
  load(): Promise<QuoteDraft | undefined>;
  save(draft: Omit<QuoteDraft, 'id'>): Promise<void>;
  clear(): Promise<void>;
}

export interface Repositories {
  products: ProductsRepo;
  quotes: QuotesRepo;
  listSends: ListSendsRepo;
  clients: ClientsRepo;
  drafts: DraftsRepo;
}
```

Adapters are constructed per authenticated session:
`createSupabaseRepositories(client, userId)`; the fake equivalent is
`createInMemoryRepositories({ userId, isAdmin })`. `ProductsCache` is an
implementation detail of `DataProvider`:

```ts
export interface ProductsSnapshot {
  getSnapshot(): Product[] | undefined;
  subscribe(listener: () => void): () => void;
  ensureLoaded(): Promise<void>;                  // StrictMode-safe first load
  refresh(): Promise<void>;                       // keeps last snapshot on error
  mutate<T>(fn: () => Promise<T>): Promise<T>;    // write then refresh
}
```

### Auth ports (`src/auth/ports.ts`)

```ts
export interface AuthSession {
  userId: string;
  email: string | null;
}

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>; // rejects with user-safe message
  signOut(): Promise<void>;
}
```

`AuthProvider` exposes `status: 'loading' | 'unauthenticated' | 'authenticated'`
plus `session` and `signOut`. Supabase's `onAuthStateChange` (`INITIAL_SESSION`
included) is the single source of truth; the client uses default
`persistSession`/`autoRefreshToken`. The security boundary is RLS, not the gate.
`DataProvider` constructs the repositories with `session.userId` once the status
is `authenticated`.

### Backup v3 (`src/utils/exportImport.ts`)

```ts
export const BACKUP_VERSION = 3;

export interface BackupFile {
  version: number;
  exportedAt: string;
  products: Product[];
  quotes: SavedQuote[];
  listSends: ListSend[];          // new in v3; absent in v1/v2
}

export interface ImportPreview {
  toAdd: ProductInput[];
  toUpdate: { id: number; input: ProductInput }[];
  quotesToAdd: SavedQuote[];
  listSendsToAdd: ListSend[];     // new in v3
  errors: ImportError[];
}

export interface ImportResult {
  success: number;
  updated: number;
  quotesAdded: number;
  listSendsAdded: number;         // new in v3
  errors: ImportError[];
}

// v1: bare Product[] · v2: { version:2, products, quotes } · v3: + listSends
export function parseProductImport(text: string): {
  valid: ProductInput[]; quotes: SavedQuote[]; listSends: ListSend[]; errors: ImportError[];
};

export function listSendSignature(send: ListSend): string;
// JSON of { fecha: ISO, cliente: trimmed+lowercased, items: [{nombre, formato, precioNeto, precioBruto}] }

export function createBackupService(repos: Repositories): {
  exportBackup(): Promise<void>;                  // reads listOwn(): one user's partition
  previewImport(text: string): Promise<ImportPreview>;  // matches against listOwn()
  applyImport(preview: ImportPreview): Promise<ImportResult>;
};
```

### Supabase rows and mapping (`src/data/supabase/`)

```ts
export interface ProductRow {
  id: number; nombre: string; categoria: string; formato: string;
  precio_neto: number; disponible: boolean; owner_id: string; created_at: string;
}
export interface QuoteRow {
  id: number; fecha: string; cliente: string | null; items: QuoteItem[];
  total_neto: number; iva: number; total: number; owner_id: string; created_at: string;
}
export interface ListSendRow {
  id: number; fecha: string; cliente: string; items: ListSendItem[];
  owner_id: string; created_at: string;
}
export interface ProfileRow {
  id: string; email: string; nombre: string; rol: 'admin' | 'vendedor'; created_at: string;
}
```

Mappers convert `precio_neto → precioNeto`, `owner_id → ownerId`,
`fecha string → Date`, and insert payloads convert `Date → ISO`. Error mapping:

- `error.code === '23505'` → `Error('Ya existe un producto llamado "<nombre>"')`,
  preserving the exact user-facing message (Decision 4).
- UPDATE/DELETE returning 0 rows → ownership error
  (`'No se puede modificar un registro de otro usuario.'`), because RLS filters
  foreign rows silently instead of raising (Decision 2):

```ts
async update(id: number, changes: Partial<ProductInput>): Promise<void> {
  const { data, error } = await client
    .from('productos').update(toRowPatch(changes)).eq('id', id).select('id');
  if (error) throw mapPostgrestError(error);
  if (!data || data.length === 0) throw new OwnershipError();
}
```

### Schema / RLS / trigger (`supabase/migrations/20261005000000_init.sql`)

```sql
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

-- Repeat the same four policies on cotizaciones and listas_enviadas with the
-- same names prefixed by table (select_own_or_admin / insert_own / update_own /
-- delete_own), identical using/with check expressions.

create policy "perfiles_select_own_or_admin" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin((select auth.uid())));

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
```

Notes: `auth.uid()` in a column default requires the insert to carry a user JWT
(always true for the app and `seedIfEmpty`; service-role/SQL inserts must set
`owner_id` explicitly). Anon has no policies and no grants, therefore no access.
`perfiles` has no authenticated write policies: the trigger (definer) inserts,
and role changes go through the dashboard/SQL.

### Env / bootstrap

```ts
// src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string; // legacy anon key or sb_publishable_ key
  readonly VITE_E2E?: string;               // '1' = stub auth + fake repos
}
```

`.env.local` (already gitignored via `*.local`) holds the dev project values.
Missing config without `VITE_E2E=1` renders a small configuration-error screen
instead of booting a broken app. The anon/publishable key is public by design
(RLS is the boundary); the service-role key is never used by the app.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (pure) | v3 parse/validate, v1/v2 compatibility, quote + list-send signatures, client-name merge, price utils | Vitest, no backend, no IndexedDB |
| Unit (adapters) | query shape (`list` without owner filter vs `listOwn` `.eq('owner_id', userId)`; seed upsert `onConflict: 'owner_id,nombre'`; owner-scoped seed count), row↔domain mapping, Date conversion, `23505` → Spanish message, 0-row update/delete → ownership error | Injected stub of the supabase `from()` chain; no network |
| Unit (hooks/components) | product CRUD flows, draft autosave/restore/clear, quote save, history/delete, client prices, owner-scoped import preview/apply | `DataProvider` + in-memory fakes (`{ userId, isAdmin }`); drop `fake-indexeddb/auto` |
| Unit (auth) | gate states, login success/error, sign-out | Fake `AuthPort` |
| E2E | existing responsive/diagnose specs unchanged; new auth-gate spec | Playwright with `VITE_E2E=1` (fake auth + seeded fake repos) |
| Integration (manual, dev project) | migrations apply; 5 users sign in; per-user seed = exactly 44 rows each; CRUD product; save quote/list send; import v3 per user; admin reads all and writes own only; vendor A cannot read/write vendor B rows; anon denied; no `42P17` recursion | Pre-cutover checklist + the RLS probe below |
| Coverage | keep 60/55/60/60 thresholds | `src/data/testing/**` excluded; production code covered through fakes + stub-client adapter tests |

RLS probe (dev project only; adjust the uuid and exit the transaction):

```sql
-- Run against the dev project after creating two vendor accounts. Impersonation
-- is transaction-local.
begin;
  select set_config('request.jwt.claims',
                    '{"sub":"<vendor-a-uuid>","role":"authenticated"}', true);
  set local role authenticated;
  select public.is_admin();                       -- false
  select count(*) from public.productos;          -- vendor A rows only
  update public.productos set precio_neto = precio_neto
    where owner_id = '<vendor-b-uuid>';           -- 0 rows (silent RLS filter)
rollback;

begin;
  select set_config('request.jwt.claims',
                    '{"sub":"<admin-uuid>","role":"authenticated"}', true);
  set local role authenticated;
  select public.is_admin();                       -- true
  select count(*) from public.productos;          -- all owners' rows
rollback;
```

Coverage risk to watch in tasks: new auth/data files must each be exercised or
the global thresholds fail — the checklist for slices 3/4/5 must include
`pnpm coverage` with real numbers, not just "green".

## Threat Matrix

N/A — no routing, shell commands, subprocesses, VCS/PR automation,
executable-file classification, or process-integration boundary is introduced by
this change. The new boundary is an authenticated HTTP data API (Supabase)
protected by RLS, covered by the schema/RLS contracts, the adapter tests, and
the manual RLS probe above.

## Migration / Rollout

**Preconditions**: Supabase project (Free, dev/migration only); the 5 account
emails; `.env.local` for the dev project; deploy = Vercel auto-deploy on merge
to `master` (`master` is protected, so every change lands through a PR).

**Phase A — pre-cutover (prod unaffected)**
1. Merge slice 1 to `master`, deploy. Users now have v3 export and keep using
   Dexie normally.
2. Build the tracker: slices 2–6 as stacked PRs, each with `verify` + `e2e`
   green.
3. Apply migrations to the dev project; create the 5 dev accounts; promote the
   admin `rol`; run the RLS probe and the manual integration checklist.

**Phase B — cutover day (per-device migration)**
1. Announce the freeze. Every user opens the current app **on their own
   device**, exports a v3 backup, and stops entering data. Each file is the
   migration source for its owner.
2. Create prod Supabase resources: apply migrations, create the 5 accounts
   (auto-confirm, self-signup disabled), run the admin `rol` UPDATE and the
   display-name UPDATE.
3. Merge the tracker to `master` and deploy (the cutover build).
4. Each user signs in on their own device → per-user seed (44 products owned by
   that user) → Import their own v3 file through the menu. Import is additive
   and owner-scoped: products update by name among their own rows, quotes and
   list sends merge by signature.
5. Verify per user: row counts per table for that owner; every row has
   `owner_id`; `ClientPrices` shows expected history for two known clients;
   quote history and list sends intact. The admin additionally checks his global
   read view and that a foreign-row edit is rejected. Re-importing a file must
   add zero duplicates.
6. There is no canonical file: all five users run this independently; nobody
   imports someone else's file.

**Phase C — rollback**
- Before any Supabase write: revert to the previous `master` build; devices
  still hold their Dexie data untouched.
- After Supabase writes: redeploy the previous build and have each user import
  their latest v3 file into Dexie. **Supabase writes made after the cutover are
  not carried back** — communicate the cutover point.
- Fix-forward on Supabase is preferred while server rows are still disposable:
  delete one user's rows and re-import that user's v3 file (per-user recovery,
  not a global reset).

**Phase D — go-live gate**
- Upgrade the project to Pro (or get an explicit signed-off exception) before
  real salespeople rely on it: Free has no automatic backups, no PITR, and
  pauses after ~1 week idle. Until Pro, keep periodic manual v3 exports
  (README). Owner: Piwen.
- Post-cutover follow-ups (not Phase 1): Realtime updates, a dedicated admin
  supervision screen, normalized item tables if reporting arrives, password
  reset UX.

## Open Questions

- [ ] Confirm the admin's in-app global view consequences: the admin's
      Productos/Historial/Clientes show every owner's rows (per-user duplicate
      product names), his PDF and "Guardar lista enviada" build from the global
      product set, and foreign-row edits/deletes fail with the ownership
      message. Non-blocking — the success criteria mandate the global read
      view — but tasks must not "fix" it by self-scoping.
- [ ] Confirm the ownership-error copy
      (`'No se puede modificar un registro de otro usuario.'`) is acceptable as
      a data-layer string; no markup change is introduced.
- [ ] Temporary password delivery to the 5 users and the freeze announcement
      channel (operational, dashboard provisioning).
- [ ] Optional later hardening: a repeatable RLS test job (pgTAP /
      `supabase test db` / Docker) wired into CI — explicitly out of Phase 1.
