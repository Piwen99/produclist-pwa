# Feature: Native Mobile Navigation Shell

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/mobile-native-navigation/tasks`.
> This is a **shell / chrome change**: navigation, safe areas, and layout padding. No
> schema, type, port, mapper, repository, or route-contract change.

## Objective

Make the installed PWA feel like a native mobile app on phones: a **fixed bottom tab
bar** with the five destinations, a **slim top bar** for brand + overflow + contextual
primary action, correct **safe-area** handling on notch/home-indicator devices, and
**no horizontal scrolling** anywhere in the nav. Desktop keeps the current top tabs.

## Problem

1. The header packs `[☰] + 5 text tabs + [+]` into one row. Measured at a ~390px
   viewport: `☰` 36px + tabs ≈333px (Productos/Cotizador/Historial/Listas/Clientes at
   `text-xs`) + `+` 36px + container padding 24px ≈ **429px**. It overflows by ~40px, so
   "Clientes" clips to "Cliente…" and the bar must be scrolled horizontally.
2. `overflow-x-auto` is being used **as navigation**. Horizontally scrollable tabs hide
   destinations and give almost no affordance that more exist (a 2px scrollbar).
3. `index.html` viewport has no `viewport-fit=cover`, so every `env(safe-area-inset-*)`
   would be inert. Combined with `apple-mobile-web-app-status-bar-style:
   black-translucent`, the sticky header can sit **under the notch** when installed.
4. `theme-color` is hardcoded `#1a1a1a`. In light mode the OS status bar stays dark
   while the header is white — a tell that it is a web page, not an app.
5. The `+` "Nuevo Producto" button is **global**; it renders on Cotizador, Historial,
   Listas and Clientes, where creating a product is meaningless.
6. The PDF FAB (`bottom-4 right-4`) and the PWA `InstallPrompt` (`bottom-20`) already
   occupy the strip a bottom tab bar needs.

## Why (motivation and value)

The user is a salesperson using this app on a phone in the field, installed to the home
screen. Native-feeling navigation means every destination is visible at once,
thumb-reachable, and requires zero discovery. The current scroll-to-find pattern is the
single most visible "this feels like a website" tell.

## Scope

### In scope

1. **New `src/components/BottomNav.tsx`** — mobile-only (`sm:hidden`), fixed to the
   bottom, five destinations (Productos, Cotizar, Historial, Listas, Clientes) as
   icon-over-label items, active state via `NavLink` + `aria-current="page"`, tap targets
   ≥ 44px, `padding-bottom: env(safe-area-inset-bottom)`.
2. **Header restructure** (`src/App.tsx`) — on mobile the header holds `☰` (overflow
   menu, unchanged contents) + brand title + contextual primary action; the top tab
   `nav` becomes `hidden sm:flex` (desktop unchanged) and `overflow-x-auto` is removed.
3. **Safe areas** — add `viewport-fit=cover` to the `index.html` viewport meta; apply
   `env(safe-area-inset-top)` to the header and `env(safe-area-inset-bottom)` to
   `BottomNav`.
4. **`theme-color` per color scheme** — two `theme-color` metas with
   `media="(prefers-color-scheme: light|dark)"` matching the header background.
5. **Contextual primary action** — the `+` "Nuevo producto" renders **only on the
   Productos route** (`/`); other routes show no create-product affordance.
6. **Overlay repositioning** — raise the PDF FAB and the `InstallPrompt` above the
   bottom nav on mobile; add bottom content padding so lists are never hidden behind the
   bar; update the existing footer spacer.
7. **Mobile label shortening** — "Cotizador" → "Cotizar" in the mobile bar.
8. **Remove the scrollable tab strip** and its scrollbar reliance for navigation.

### Out of scope

- Any data-layer, schema, type, port, mapper, repository, RLS, or auth change.
- New routes or route-contract changes (the five destinations already exist).
- Desktop navigation redesign (top tabs stay as they are).
- PDF generation, export/import, or list-send logic.
- Offline behavior (still unsupported, unchanged).
- Changing `user-scalable=no` / `maximum-scale=1.0` (flagged below, not changed here).

## Constraints

- No new dependencies. Tailwind v4 + existing components and inline SVG icons only.
- Spanish UI copy (existing app language); English artifacts.
- Keep dark-mode classes consistent with the current palette.
- `prefers-reduced-motion` and `:focus-visible` styles must keep working.
- Do not regress the existing App tests `src/__tests__/App.listas.test.tsx` and
  `src/__tests__/App.pdfScope.test.tsx`.
- Strict TDD where the repo's test setup applies: tests travel with their work unit.
- Keep `verify` (lint, `tsc -b`, coverage 60/55/60/60) and `e2e` green.

## Authorized scope

Implementers may only touch these surfaces; anything else is out of budget and must be
raised.

- New `src/components/BottomNav.tsx` (+ `src/components/__tests__/BottomNav.test.tsx`)
- `src/App.tsx` (+ any App-level test it needs, e.g. `src/__tests__/App.nav.test.tsx`)
- `src/components/PDFButton.tsx`
- `src/components/InstallPrompt.tsx`
- `index.html` (viewport + theme-color metas)
- `src/App.css` / `src/index.css` only for safe-area or overscroll helpers if needed
- **Unchanged**: `src/data/**`, `src/types/**`, `src/auth/**`, `src/pdf/**`,
  `src/utils/**`.

Authoring artifact edit surface for this document: `odd/tasks/mobile-native-navigation.md`.

## Actionable checklist

Each task is one reviewable work unit with: deliverable, acceptance, applicable checks,
route (inline vs delegated) + trigger evidence, and an advisory changed-line forecast.
Stable IDs must never be renumbered.

### T1 — Bottom tab bar + responsive nav split + safe areas

- **Delivers**: `BottomNav` component rendering the five destinations as
  icon-over-label `NavLink`s with active state and `aria-current`; `App.tsx` header top
  tabs become `hidden sm:flex` with `overflow-x-auto` removed; `BottomNav` mounted
  mobile-only (`sm:hidden`) in the app shell; header gets `env(safe-area-inset-top)` and
  `BottomNav` gets `env(safe-area-inset-bottom)`; `index.html` gains `viewport-fit=cover`
  and per-scheme `theme-color`; content bottom padding keeps the last row clear of the
  bar.
- **Acceptance**: at a ~390px viewport all five destinations are visible with **zero
  horizontal scroll**; at ≥640px the top tabs render and the bottom bar is absent; the
  active destination is highlighted in both navs; the header background extends under
  the status bar and the bar clears the home indicator on standalone iOS.
- **Checks**: `coverage`, `lint`, `tsc -b`, `e2e`.
- **Route**: delegated (new component + test + `App.tsx` shell edit = 3 non-trivial
  files).
- **Forecast**: ~220–330 authored lines incl. tests.

### T2 — Contextual `+` and overlay repositioning

- **Delivers**: the `+` "Nuevo producto" action renders only on the Productos route;
  the PDF FAB and `InstallPrompt` are lifted above the bottom nav on mobile while
  keeping their desktop positions; the footer spacer and content padding account for
  the bottom bar height + safe area.
- **Acceptance**: navigating to Cotizador/Historial/Listas/Clientes hides the create
  action; the FAB and install prompt never overlap or sit behind the bottom bar; the
  desktop layout is visually unchanged.
- **Checks**: `coverage`, `lint`, `tsc -b`.
- **Route**: delegated (`App.tsx` + `PDFButton.tsx` + `InstallPrompt.tsx` = 3 files).
- **Forecast**: ~120–200 authored lines incl. tests.

### T3 — Verification follow-ups: dark `theme-color` and the empty list-send copy

- **Delivers**: the dark `theme-color` meta matches the sticky header background —
  `dark:bg-gray-800` in this project's Tailwind v4 resolves to
  `oklch(27.8% 0.033 256.848)` = `#1e2939` (not the Tailwind v3 `#1f2937`, and not the
  hardcoded `#1a1a1a`) — so the OS status bar stops mismatching the header in dark
  scheme; and the backup-import confirmation omits the list-send clause when the file
  carries no list sends, so it no longer reads "0 listas enviadas".
- **Acceptance**: in dark scheme the status-bar color equals the sticky header
  background; a backup with zero list sends shows a confirmation with no list-send
  clause, and one with N list sends still reads "N listas enviadas".
- **Checks**: `coverage`, `lint`, `tsc -b` (e2e not applicable — copy + a meta tag only).
- **Route**: inline (two mechanical edits in `index.html` and `App.tsx` plus one focused
  test file; no research or unresolved design).
- **Forecast**: ~40–70 authored lines incl. the test.

## Acceptance criteria (change-level)

- [ ] At a ~390px viewport all five destinations are visible with no horizontal scroll.
- [ ] Bottom bar is mobile-only (`sm:hidden`); top tabs are desktop-only (`hidden sm:flex`).
- [ ] Header clears the notch and the bottom bar clears the home indicator when installed.
- [ ] `theme-color` matches the header in both light and dark schemes.
- [ ] The `+` create-product action appears only on Productos.
- [ ] PDF FAB and `InstallPrompt` do not overlap the bottom bar.
- [ ] No data-layer, type, port, mapper, or route-contract change.
- [ ] `verify` (lint, `tsc -b`, coverage 60/55/60/60) and `e2e` green.

## Applicable checks

Commands (exact): `pnpm coverage`, `pnpm lint`, `pnpm exec tsc -b`,
`pnpm exec playwright test`.

| Task | coverage | lint | tsc -b | e2e |
|------|:--------:|:----:|:------:|:---:|
| T1 | ✔ | ✔ | ✔ | ✔ |
| T2 | ✔ | ✔ | ✔ | – |
| T3 | ✔ | ✔ | ✔ | – |

Overall: every task green; coverage holds 60/55/60/60; `verify` + `e2e` green.

## Progress / verification evidence / next step

- **T1 — done.** Branch `feat/bottom-nav-shell`, commit `0030343`
  (`feat(nav): add native bottom tab bar for mobile`), 7 files, +345/−67. Adds
  `src/components/BottomNav.tsx` (5 destinations, inline SVG, `sm:hidden`, fixed +
  `env(safe-area-inset-bottom)`), makes the header top tabs `hidden sm:flex` from
  `NAV_ITEMS` (removes `overflow-x-auto`), adds a mobile brand wordmark, header
  `env(safe-area-inset-top)`, `viewport-fit=cover` + per-scheme `theme-color`, and a
  footer spacer `h-[calc(5rem+env(safe-area-inset-bottom))] sm:h-24`. Checks: `tsc -b` 0,
  `lint` 0, `coverage` (85.45/77.38/87.34/87.72, floor 60/55/60/60), Playwright 20/20.
  Note: `src/__tests__/App.listas.test.tsx` disambiguates the now-duplicated "Listas"
  link by scoping to the bottom nav.
- **T2 — done.** Branch `feat/native-mobile-chrome`, commit `8641661`
  (`feat(nav): make the create action contextual and lift overlays above the tab bar`).
  The `+` "Nuevo producto" renders only on `/`; the PDF FAB and `InstallPrompt` clear the
  bar via `env(safe-area-inset-bottom)` while desktop is unchanged. Checks: `tsc -b` 0,
  `lint` 0, `coverage` (85.46/77.44/87.34/87.73), Playwright 22/22. Parent spot check:
  12/12 on the three App suites.
- **T3 — done.** Branch `feat/nav-followups`, commit `085ff4f`
  (`fix(nav): match the dark theme-color and hide the empty list-send clause`). Closes the
  two real verification leftovers: the dark `theme-color`/header mismatch (T1 item 4 — the
  meta was `#1a1a1a` while the header is Tailwind v4 `gray-800` = `#1e2939`) and the
  zero-list-send copy nit (T2 — the import dialog read "0 listas enviadas"). Adds
  `src/__tests__/App.importMessage.test.tsx`, which drives the real export/import path
  (hidden file input → `previewImport` → `ConfirmDialog`) for both counts. Checks:
  `tsc -b` 0, `lint` 0, `coverage` (85.97/78.12/87.75/88.29, floors 60/55/60/60).

**Native review (RDD) — unavailable, typed.** Both tasks were implemented under
`gentle-ai review-mode on` (global), but the OpenCode host relay cannot capture a reviewer
result in this environment: the installed OpenCode plugin set is V1
(`~/.config/opencode/plugins/opencode-review-transport.ts`) and gentle-ai 4.0.0's review
transport requires the V2 plugin (`plugins-v2/`, relay contract
`gentle-ai.opencode-relay/v2-staged`), which this OpenCode (1.18.5) does not qualify for.
`gentle-ai sync` reports all managed assets up to date and `gentle-ai install --agent
opencode` does not create `plugins-v2/`. The transport returns `capability_unavailable` /
`immutable_review_transport_unsupported`. T1's lineage `review-e8710f08b079de82` stays
non-terminal. The user chose to continue without filing a report; the writer's foreground
verification above is the verification of record.

**Known pre-existing flake (follow-up, not caused by this change):**
`src/__tests__/App.pdfScope.test.tsx:43` can exceed `findBy*`'s 1s timeout on the first
full `pnpm coverage` run under CPU contention (ProductList still on its loading skeleton);
it passes in isolation and on re-run.

Next step: open the PRs (PR-A T1 → `master`, PR-B T2 stacked after it) and, if desired,
upgrade OpenCode to a version whose `@opencode-ai/plugin` exposes SDK v2, then re-install
to enable the native review transport.

## Delivery strategy + slice boundaries

- **Strategy**: one PR per task, targeting `master`; tests travel with their unit.
- **Budget**: 400 changed lines is an advisory heuristic; if a task approaches it, split
  the task, never shrink the tests.
- **Order**: T1 → T2. T2 depends on T1's bar being in place (it repositions against it),
  so T2 stacks on T1.

| PR | Work unit | Target | Forecast (add+del) |
|----|-----------|--------|--------------------|
| PR-A | T1 | `master` | ~220–330 |
| PR-B | T2 | `master` (after A) | ~120–200 |

Rollback: each PR is UI-only; reverting restores the prior rendering with no data
consequence.

## Rationale for meaningful accepted decisions

- **Bottom tab bar over priority+ overflow**: the user explicitly asked for a native
  mobile-app feel. A bottom bar makes every destination visible and thumb-reachable,
  which the scroll-to-find strip does not; it is the standard pattern for an installable
  PWA. Five destinations is exactly the recommended maximum for a bottom bar.
- **Desktop keeps the top tabs**: at `max-w-5xl` the five tabs fit comfortably; there is
  no reason to change a working desktop layout.
- **`+` becomes contextual**: it was never a global action — creating a product only
  makes sense in Productos; showing it elsewhere invites dead-end taps.
- **`viewport-fit=cover` + safe-area insets**: required for the header/nav to behave like
  native chrome on notched devices; without it the insets are inert.
- **Per-scheme `theme-color`**: the status bar must match the header, otherwise the
  installed app still reads as a web page.
- **Flagged, not changed — `user-scalable=no`/`maximum-scale=1.0`**: these block pinch
  zoom (WCAG 1.4.4). Left as-is in this change to stay surgical; recommend revisiting as
  a separate accessibility decision.
