# supabase-data-access Specification

## Purpose

The repository/data-access layer (ports and adapters) that replaces every Dexie call while preserving current UI contracts. Components and hooks depend on typed repository interfaces; Supabase adapters implement them in production, in-memory fakes implement them in unit tests, and the Playwright stub reuses the same fakes. Dexie is retired. There is no offline cache, no write queue, and no Realtime in Phase 1; failure and refresh behavior below is the accepted, defined consequence of going server-first.

## Requirements

### Requirement: Ports-and-adapters boundary with no direct Dexie access

The system MUST route all data access through repository interfaces (`ProductsRepo`, `QuotesRepo`, `ListSendsRepo`, `ClientsRepo`, `DraftsRepo`, aggregated as `Repositories`) provided via `DataProvider`/`useData()`. Components and hooks — including `QuoteHistory`, `ClientPrices`, the product hooks, `useQuote`, the quote PDF path, and the export/import service — MUST NOT import Dexie or any `db` module directly. The Supabase client MUST be constructed once and injected into adapters so tests never need a live project.

#### Scenario: Product flow works against either backend

- GIVEN the same `Cotizador` interaction sequence
- WHEN executed once with Supabase adapters and once with in-memory fakes
- THEN both runs MUST produce the same visible catalog, quote, and history outcomes

#### Scenario: No direct database imports remain

- GIVEN the migrated codebase
- WHEN the source tree is searched for direct Dexie/`db` imports in components, hooks, and utils
- THEN no such import SHALL exist outside the retired-and-deleted Dexie module and its deleted tests

### Requirement: Products repository contract

`ProductsRepo` MUST expose `list()` (sorted by `nombre`), `create(input)` (rejecting duplicates with the exact Spanish message `Ya existe un producto llamado "<nombre>"`), `update(id, changes)`, `remove(id)`, and `seedIfEmpty(seed)` (upsert on `nombre`, ignoring duplicates). Adapters MUST map rows (`precio_neto` to `precioNeto`, ISO strings to `Date`) and MUST translate the PostgREST uniqueness error (`23505`) into the Spanish duplicate-name message; other errors pass through to the existing generic handling. Product mutation hooks MUST keep their current contracts and user-facing behavior.

#### Scenario: Product list is alphabetically ordered

- GIVEN products named "Zanahoria", "Almendra", "Nuez"
- WHEN `list()` resolves
- THEN the returned order MUST be Almendra, Nuez, Zanahoria

#### Scenario: Duplicate product name surfaces the Spanish message

- GIVEN a product named "Almendra" exists
- WHEN `create()` is called with `nombre` "Almendra"
- THEN the call MUST reject with `Ya existe un producto llamado "Almendra"`

#### Scenario: Row mapping converts server shape to domain shape

- GIVEN a product row with `precio_neto` and ISO `created_at`
- WHEN it passes through the adapter
- THEN the domain object MUST expose `precioNeto` as a number and dates as `Date` instances

### Requirement: Quotes, list-sends, and client-names repositories

`QuotesRepo` MUST expose `list()` (by `fecha` descending), `create(data)`, and `remove(id)`. `ListSendsRepo` MUST expose `list()` (by `fecha` descending), `create(data)`, and `remove(id)`. `ClientsRepo.listNames()` MUST return the merged, deduplicated client-name list derived from quotes and list sends via the pure merge function. `QuoteItem.productId` MUST remain write-only snapshot metadata: it is stored on add and MUST never be used to resolve against `productos.id`.

#### Scenario: Quote history is newest-first

- GIVEN saved quotes from three different dates
- WHEN `QuotesRepo.list()` resolves
- THEN the order MUST be newest `fecha` first

#### Scenario: Client names merge both sources without duplicates

- GIVEN quotes for "Almacén Sur" and list sends for "almacén sur" and "Panadería Norte"
- WHEN `ClientsRepo.listNames()` resolves
- THEN "Almacén Sur" MUST appear exactly once alongside "Panadería Norte"

#### Scenario: Stale product references in old quote items do not break reads

- GIVEN a quote whose item `productId` no longer matches any catalog row
- WHEN the quote is listed or displayed
- THEN the quote MUST render from its embedded snapshot and MUST NOT attempt a catalog lookup by that id

### Requirement: Browser-local drafts repository

`DraftsRepo` (`load`/`save`/`clear`, async) MUST persist the single-slot quote-draft autosave (`items`, `totalNeto`, `iva`, `total`) in `localStorage` under key `produclist:quoteDraft`. Drafts MUST be excluded from backups by design. An in-progress draft MUST survive a page refresh even when the network is unavailable, because the draft never touches the server.

#### Scenario: Draft autosave round-trips locally

- GIVEN a quote with two items in progress
- WHEN the draft is saved and the page reloads with no network
- THEN `load()` MUST return the same items and totals

#### Scenario: Clearing the draft empties the slot

- GIVEN a saved draft
- WHEN `clear()` resolves
- THEN `load()` MUST return `undefined`

### Requirement: Products cache and refresh model

The products cache (snapshot-based, StrictMode-safe) MUST preserve the `Product[] | undefined` contract where `undefined` means "not loaded yet". It MUST refresh on mount (once), on `visibilitychange` to visible, on `window.online`, and after every mutation. `ensureLoaded()` MUST be safe under double-mount. On refresh failure the cache MUST keep the last snapshot rather than clearing it.

#### Scenario: First load exposes undefined before data

- GIVEN a fresh boot with a slow network
- WHEN the product list renders before the fetch resolves
- THEN it MUST observe `undefined` (the loading state), not an empty catalog

#### Scenario: Refocus picks up another user's change without Realtime

- GIVEN user A edited a price while user B's tab was hidden
- WHEN user B's tab becomes visible again
- THEN the next product read MUST reflect user A's edit

#### Scenario: Failed refresh keeps the last good snapshot

- GIVEN a loaded catalog followed by a failed refresh
- WHEN the failure occurs
- THEN the visible catalog MUST remain the last good snapshot

### Requirement: Defined failure behavior with no offline UX

The system MUST NOT provide an offline cache, offline banner, or write queue in Phase 1. Every repository call MUST reject on failure. Mutations MUST surface the existing `toast.error` messages; component-level loads MUST keep their current `console.error`/loading fallbacks. On first-load failure the products value MUST stay `undefined` so the product list shows its existing "Cargando productos..." skeleton rather than a misleading empty catalog.

#### Scenario: Failed product mutation shows the existing error toast

- GIVEN an authenticated session with the network down
- WHEN the user adds a product
- THEN the existing error toast MUST appear and the catalog MUST be unchanged

#### Scenario: First-load failure shows the loading skeleton, not an empty catalog

- GIVEN a boot where the initial products fetch fails
- WHEN the product list renders
- THEN it MUST show the existing loading state and MUST NOT claim the catalog is empty

### Requirement: No Realtime in Phase 1

The system MUST NOT subscribe to Supabase Realtime in Phase 1. Changes made by other users MUST become visible on refocus, reconnect, post-mutation refresh, or reload — never live.

#### Scenario: Concurrent edit resolves to last write without live push

- GIVEN two users viewing the same product
- WHEN user A saves a price change while user B is idle
- THEN user B MUST NOT see the change until a refresh trigger or reload occurs, and the stored value MUST be user A's write

### Requirement: Testability and green CI

Unit tests MUST run against in-memory fake repositories with no IndexedDB (`fake-indexeddb` retired) and no network. Supabase adapters MUST be unit-tested against an injected stub of the client's `from()` chain covering query shape, row-to-domain mapping, `Date` conversion, and PostgREST error translation. The Playwright suite MUST run with `VITE_E2E=1`, booting fake auth plus in-memory repositories pre-seeded with the canonical seed products; existing responsive/diagnose assertions MUST keep passing. Coverage thresholds 60/55/60/60 MUST hold with `src/data/testing/**` excluded; the `verify` and `e2e` jobs MUST stay green on every delivery slice.

#### Scenario: Product CRUD suite runs fully offline

- GIVEN a clean checkout with no network and no Supabase credentials
- WHEN `pnpm coverage` runs
- THEN all product, quote, draft, history, client-price, and import suites MUST pass through fakes

#### Scenario: E2E suite runs without credentials

- GIVEN no Supabase secrets in the environment
- WHEN `pnpm exec playwright test` runs with the stub flag
- THEN the full suite including the auth-gate spec MUST pass

### Requirement: Dexie retirement

Dexie MUST be fully retired from the shipped build: the Dexie schema/helpers module, the old seed module, `dexie`, `dexie-react-hooks`, and `fake-indexeddb` dependencies, and their tests MUST be removed, and no `db` (Dexie) import SHALL remain in shipped source. The PDF path MUST NOT use live queries: the document component MUST receive `products` as a prop from a caller that reads them in the app tree.

#### Scenario: Shipped bundle carries no Dexie dependency

- GIVEN the cutover build
- WHEN package dependencies and shipped source are inspected
- THEN neither `dexie` nor `dexie-react-hooks` nor `fake-indexeddb` SHALL be present and no shipped module SHALL import them
