# Feature: Client & Quote History UX (Browsing Saved Quotes and Client Lists)

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/client-quote-history-ux/tasks`.
> This is a **pure UI/UX change**: it adds rendering and search over data that is
> already stored and already mapped. No schema, type, port, mapper, or migration change.

## Objective

Make saved cotizaciones and client-facing lists (`listas enviadas`) legible and
findable **without opening each record**: surface the stored client name and date in
the quote history, add a search-by-client, give the client area a per-client document
view, and add a global searchable list of sent lists — reusing the existing
`ProductList` search pattern for consistency.

## Problem

1. `SavedQuote.cliente` is persisted by `Cotizador` (the "Cliente (opcional)" input)
   and returned by `quotes.list()`, but `QuoteHistory` **never renders it**. Every
   saved quote shows only date, items and totals, so quotes cannot be told apart by
   client without reading their items.
2. `QuoteHistory` has **no search/filter** at all.
3. Saved `listSends` are written (`listSends.create(...)`) but there is **no listing
   UI anywhere**. `ClientPrices` only aggregates the *last net price per product* for
   one selected client; it does not list the documents. There is no per-client
   document history and no global list of sent lists.

## Why (motivation and value)

The salesperson names a quote/list for a client and then cannot see that name; and
finding a past quote or sent list means scanning a flat, fully-expanded list. The
value is faster recall and reuse of prior quotes/lists per client. It is a display +
findability change only — the data is already there.

## Scope

### In scope

1. **`QuoteHistory`**: render `cliente` as the card title (fallback "Sin cliente")
   with the date; add a **client search** (input + `useMemo` filter + Ctrl+/ shortcut
   + result counter + "sin resultados" state) mirroring `ProductList`; convert each
   quote to a **compact row** (client · date · total · N items) that expands on click.
2. **New route `/listas` + header nav entry**: a global list of saved sent lists
   (date, client, N items) with the same client search pattern.
3. **`ClientPrices`**: keep the client selector and the last-price-per-product table,
   add a **per-client document history** (that client's sent lists and quotes, newest
   first) and tidy the price table (clear source + date per row).

### Out of scope

- Any data-layer/schema change. `ListSend.fecha` and `SavedQuote.cliente` are already
  stored and mapped (`src/data/supabase/mappers.ts:104-112,79-90`). Item counts derive
  from `items.length`; any total derives from existing `precioNeto`/`precioBruto`.
- Editing, reopening, or re-sending a saved quote/list.
- PDF / export / import changes.
- Cross-user or admin-specific views (RLS unchanged).
- Offline behavior.

## Constraints

- Reuse the existing `ProductList` search UX/pattern for consistency (input, clear
  button, result counter, empty state, Ctrl+/ focus).
- No new dependencies. Keep Tailwind conventions and existing dark-mode classes.
- Spanish UI copy (existing app language); English artifacts.
- Keep `verify` (lint, `tsc -b`, `coverage` at 60/55/60/60) and `e2e` green.
- Strict TDD where the repo's test setup applies: tests travel with their work unit.

## Authorized scope

Implementers may only touch these surfaces; anything else is out of budget and must
be raised.

- `src/components/QuoteHistory.tsx`; `src/components/__tests__/QuoteHistory.test.tsx`
- `src/components/ClientPrices.tsx`; `src/components/__tests__/ClientPrices.test.tsx`
- New `src/components/ListSends.tsx` (+ its `__tests__` file)
- `src/App.tsx` (route + `NavLink`) and any App-level routing test it needs
- A shared UI helper if extraction reduces duplication, e.g.
  `src/components/SearchInput.tsx` (+ test), and/or a small
  `src/utils/` totals/label helper (+ test)
- **Unchanged**: `src/data/**`, `src/types/**`, `src/utils/clientTracking.ts`,
  `src/utils/listSend.ts`, `src/utils/exportImport.ts`.

Authoring artifact edit surface for this document: `odd/tasks/client-quote-history-ux.md`.

## Actionable checklist

Each task is one reviewable work unit with: deliverable, acceptance, applicable
checks, route (inline vs delegated) + trigger evidence, and an advisory changed-line
forecast. Stable IDs must never be renumbered.

### T1 — `QuoteHistory`: client name, search, compact rows

- **Delivers**: `QuoteCard` shows `cliente` as the title (fallback "Sin cliente") with
  the formatted date; a **client search** filters quotes case-insensitively by
  `cliente` (with a result counter and an empty state); each quote renders as a
  **compact row** (client · date · total · N items) that expands to the current
  detail (items + totals) on click/toggle, with correct `aria-expanded`.
- **Acceptance**: a saved quote with a client shows that client without any click; a
  quote without a client shows "Sin cliente"; typing a client filters the list and the
  counter reflects matched/total; empty search shows the "sin resultados" state; delete
  still works and keeps its admin/ownership guard; Ctrl+/ focuses the search.
- **Checks**: `coverage`, `lint`, `tsc -b`.
- **Route**: delegated (component + test are 2 non-trivial files). If a shared
  `SearchInput` is extracted, it travels in this unit.
- **Forecast**: ~180–280 authored lines incl. tests.

### T2 — Global sent-lists screen (`/listas`) + nav

- **Delivers**: a new `ListSends` screen reading `repos.listSends.list()` and rendering
  each send as a row (date · client · N items) newest first, with the same **client
  search** pattern and empty state; a `/listas` route in `App.tsx` and a header
  `NavLink` ("Listas"); the search helper is reused from T1 if extracted.
- **Acceptance**: the route renders all visible sent lists; search filters by client;
  empty catalog shows the empty state; the nav entry highlights when active and does
  not disturb the existing tabs; the screen never mutates data.
- **Checks**: `coverage`, `lint`, `tsc -b`, `e2e` (new route reachable).
- **Route**: delegated (new component + test + `App.tsx`).
- **Forecast**: ~180–280 authored lines incl. tests.
- **Dependency**: reuses the search helper from T1 if one was extracted; otherwise
  replicates the pattern (no cross-file coupling).

### T3 — `ClientPrices`: per-client documents + price-table tidy

- **Delivers**: keep the client `<select>` and last-price-per-product table; add a
  **per-client document history** below it listing that client's sent lists and quotes
  (date · kind · N items · total where applicable), newest first; tidy the price table
  rows to show source (Lista/Cotización) and date clearly and sort them predictably.
- **Acceptance**: selecting a client shows its documents (both kinds) ordered
  newest-first with the correct kind label; the last-price table still shows the most
  recent price per product (unchanged semantics from `buildClientPriceHistory`); no
  data mutation.
- **Checks**: `coverage`, `lint`, `tsc -b`.
- **Route**: delegated (component + test, possibly a small helper).
- **Forecast**: ~200–320 authored lines incl. tests.

## Acceptance criteria (change-level)

- [ ] A saved quote's client name is visible in the history without opening it.
- [ ] Quote history has a working client search with a result counter and empty state.
- [ ] A global "Listas" screen lists sent lists (date, client, N items) with a client search.
- [ ] `ClientPrices` shows a per-client document history and an intact last-price table.
- [ ] No data-layer, type, port, mapper, or migration change.
- [ ] `verify` (lint, `tsc -b`, coverage 60/55/60/60) and `e2e` green.

## Applicable checks

Commands (exact): `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`,
`pnpm exec playwright test`.

| Task | coverage | lint | tsc -b | e2e |
|------|:--------:|:----:|:------:|:---:|
| T1 | ✔ | ✔ | ✔ | – |
| T2 | ✔ | ✔ | ✔ | ✔ |
| T3 | ✔ | ✔ | ✔ | – |

Overall: every task green; coverage holds 60/55/60/60; `verify` + `e2e` green.

## Progress / verification evidence / next step

- **T1 — done.** Commit `79fb19e` on `feat/quote-history-client-search` (PR #58).
  `QuoteHistory` now shows `cliente` (fallback "Sin cliente"), adds a client search
  (input + clear + result counter + Ctrl+/ + "sin resultados" state), and collapses
  each quote into a summary row that expands to the item/totals detail; delete stays
  in the summary row with its ownership guard. Checks: `tsc -b` 0, `lint` 0,
  `coverage` 0 (thresholds 60/55/60/60 held), `QuoteHistory` suite 17/17. Native RDD
  review lineage `review-db9a1845f55f1b8f` (medium, 1 lens `review-reliability`)
  approved; authority burned. Non-blocking advisories: `R3-1` (WARNING, no-quotes
  empty boundary unproved), `R3-2` (SUGGESTION, search matches raw `cliente` vs the
  displayed normalized label), `R3-3` (SUGGESTION, `aria-controls` references an
  unmounted id while collapsed).
  **Follow-up (same PR):** all three advisories addressed — added the zero-quotes
  boundary test, filtered against the displayed `clientName` label, and gated
  `aria-controls` on the expanded state. Follow-up review lineage
  `review-9e425d8fe0e846d0` (medium, 1 lens) approved with no findings; authority burned.

- **T2 — done.** Branch `feat/list-sends-screen` (commit `94001f3` + follow-up `cce2627`),
  PR #59. New `/listas` route + "Listas" header tab listing all saved sent lists
  (date · client · N ítems) with a client search (counter, Ctrl+/, clear, distinct
  empty vs "Sin resultados"). Checks: `tsc -b` 0, `lint` 0, `coverage` 0. Native RDD
  review lineage `review-0dc53529a7918f7d` (medium, 1 lens) approved; authority burned.
  Advisories: `R3-1` (WARNING, a load error rendered as the empty state), `R3-2` (WARNING,
  ordering test unproved), `R3-3` (SUGGESTION). **Follow-up (same PR):** distinct load-error
  state with retry, and seeded the older send first so the ordering test proves
  newest-first. Follow-up review lineage `review-ac399f95b696bdd9` (medium, 1 lens)
  approved; authority burned. Remaining advisories: retry test call-count brittleness
  (SUGGESTION), no in-flight guard on retry (SUGGESTION).
- **T3 — done.** Branch `feat/client-prices-history` (this PR). `ClientPrices` now shows a
  per-client "Historial de documentos" (sent lists + quotes, newest first, kind + date +
  item count + quote total) alongside the "Últimos precios por producto" table. Checks:
  `tsc -b` 0, `lint` 0, `coverage` 0. Native RDD review lineage `review-f928a0d64e8cef1b`
  (medium, 1 lens) approved; authority burned. Non-blocking advisories: `R3-A` (WARNING,
  the document key fallback can collide with a real id), `R3-B` (SUGGESTION, id-absent
  boundary untested).

Next step: feature complete (T1–T3). Optional follow-ups: T3 `R3-A`/`R3-B` and T2 `R3-3`.

## Delivery strategy + slice boundaries

- **Strategy**: one PR per task (each work unit is cohesive and forecast under the
  400-line advisory budget), targeting `master`; tests travel with their unit.
- **Budget**: 400 changed lines is an advisory heuristic; if a task approaches it,
  split the task, never shrink the tests.
- **Order**: T1 → T2 → T3. T2 may reuse T1's search helper; if so it stacks on T1,
  otherwise it is independent.

| PR | Work unit | Target | Forecast (add+del) |
|----|-----------|--------|--------------------|
| PR-A | T1 | `master` | ~180–280 |
| PR-B | T2 | `master` (after A) | ~180–280 |
| PR-C | T3 | `master` (after B) | ~200–320 |

Rollback: each PR is UI-only and independent; reverting the PR restores the prior
rendering with no data consequence.

## Rationale for meaningful accepted decisions

- **No data change**: `ListSend.fecha` is already mapped
  (`src/data/supabase/mappers.ts:104-112`) and `SavedQuote.cliente` is already stored
  (`src/data/supabase/mappers.ts:79-90`), so display needs no migration. An earlier
  assumption that `created_at` had to be mapped was wrong and is dropped.
- **Reuse `ProductList`'s search pattern** rather than inventing a new one: the user
  asked for "un buscador como el de la lista de productos"; consistency beats novelty.
- **Compact/expandable quote rows**: quotes are currently fully expanded and long
  lists are hard to scan; collapsing to a summary row makes the client name and total
  scannable while preserving the full detail on demand.
- **A global "Listas" screen** rather than only a per-client view: the user explicitly
  asked for a searchable list of saved lists, which does not exist today.
