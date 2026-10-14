# Feature: Owner-scoped product catalog + PDF with unavailable products

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/catalog-scope-and-pdf/tasks`.
> Two small, independent deltas in the same seam: (1) the catalog read is owner-scoped,
> (2) the product PDF stops filtering `disponible`. No schema, RLS, port, or migration change.

Branch: `fix/catalog-owner-scope` (from `master` @ `ae721ee`)
Delivery strategy: `single-pr` — forecast well under 400 authored changed lines
Test runner: `pnpm test` (vitest; `pnpm exec vitest --run <paths>` for one shot)

## Specs

**S1 — Owner-scoped catalog for every principal, admin included.** The products screen (and every surface fed by the products cache) MUST show only the products owned by the session user. Today the cache comes from the RLS-visible read `repos.products.list()` (`src/data/DataProvider.tsx:51`), which for an admin also returns every other owner's rows (policy `productos_select_own_or_admin`, `supabase/migrations/20261005000000_init.sql:83`), merging the other vendors' catalogs (44 seeded rows each) into the admin's list.
- Acceptance: mounted for an admin whose repo exposes 2 rows through `list()` and 1 through `listOwn()`, the cache holds exactly the owner-scoped row.
- Acceptance: the seam calls `repos.products.listOwn(userId)` and never `repos.products.list()`.

**S2 — Every product shown is deletable.** The delete policy is owner-only (`productos_delete_own`, `supabase/migrations/20261005000000_init.sql:92`); deleting a foreign row affects 0 rows and the adapter raises `OwnershipError` (`src/data/supabase/mappers.ts:75`), which the UI reports as the generic toast "Error al eliminar el producto. Por favor intenta de nuevo." (`src/App.tsx:121`). With S1 no foreign row is ever rendered, so every rendered row is deletable. Requirement (user's words, L1): *"no puedo eliminar los productos"*.

**S3 — The products PDF includes unavailable products.** `ProductPDFDocument` MUST render every product passed in, whether `disponible` is true or false (today it filters at `src/pdf/ProductPDFDocument.tsx:307`). Requirement (user's words, L1): *"poder generar el pdf con productos "no disponibles" tambien, osea generar el pdf con los productos que esten en la lista asi no esten marcado como disponibles."*
- Acceptance: a document with one available and one unavailable product renders both names and counts 2 in the footer.
- Out of scope: any visual marker for unavailable rows (not requested).

**S4 — Consistency of the shared surfaces.** The cotizador selector, "Guardar lista enviada" and the product PDF all read the same cache, so S1 applies to them unchanged. For a vendor nothing changes (`list()` and `listOwn(userId)` both resolve to the one owner's rows under RLS). For an admin the product pool narrows to their own catalog — intended, and the reason the change is not confined to the catalog screen.

## Tasks

| ID | Spec | Route | Status | Evidence |
|----|------|-------|--------|----------|
| T1 | S1, S2 | inline | done | RED `src/data/__tests__/DataProvider.test.tsx` (14 failing) → `DataProvider.refresh` uses `listOwn(userId)` → GREEN 17/17; commit `a7e811c` |
| T2 | S3 | inline | done | RED `src/pdf/__tests__/ProductPDFDocument.test.tsx` (2 failing) → filter removed → GREEN 3/3 |
| T3 | S4 | inline | done | `pnpm lint` clean · `pnpm exec tsc -b` clean · `pnpm exec vitest --run` 548/548 (58 files) |
| T4 | — | RDD | pending | `gentle-ai review assess` on the candidate |
| T5 | S1-S4 | delegated (verify) | done | independent read-only verification: all four specs PASS, no blockers, 5 advisories |
| T6 | S1, S2, S4 | inline | done | seam probes committed as regression tests: `DataProvider.adminScope.test.tsx` (4) + the all-unavailable PDF boundary |

## Log

**L1 (user, verbatim, 2026-10-14):** *"hay varios usuarios usando el proyecto y desde que ingresaron a mi se me multiplica la lista de productos, parece que fue un error pedirte que se me copiara la lista de productos primero porque no puedo eliminar los productos y segundo por que se multiplica cada vez que alguien usa la lista.Tambien me gustaria aplicar otro cambio, poder generar el pdf con productos "no disponibles" tambien, osea generar el pdf con los productos que esten en la lista asi no esten marcado como disponibles. Aplica las correcciones necesarias primero parael problema de duplicacion de lista de productos, si me paso a mi, seguro le pasara al resto de usuarios que tienen los mismos permisos. todo bien estructurado y siguiendo ODD y despues RDD."*

**L2 — Root cause (evidence, not the user's theory).** The copy is not the defect. `seedProducts.ts` holds the 44-product base catalog; 3 users x 44 = 132, the exact count the user reported. Each vendor's rows are their own private partition; the multiplication is the admin's RLS-visible read (`list()`) returning every owner's rows at once. The undeletable symptom is the same root: those rows belong to other owners, and the delete policy is owner-only, so the adapter raises `OwnershipError`. The fix is therefore to stop reading the RLS-visible set for the catalog, not to remove the copy.

**L3 — Product decision (user).** Asked whether new users keep receiving the base 44-product catalog. Answer: **keep it** ("Mantener el catálogo base"). The seeding behavior (`seedIfEmpty`) is unchanged; a user who deletes every product still gets the base catalog back on the next load.

**L4 — Rejected alternative.** Removing the `is_admin()` clause from the `productos` SELECT policy (a new RLS migration) would enforce the same rule at the single enforcement point, but it is a permission change (high risk), needs a manual migration on the live project, and kills the admin-wide read that the design's supervision view reserves. The client-side seam narrowing is reversible, needs no database step, and does not weaken any guard. Left as a follow-up option, not done here. Note: with this change nothing in the app calls `ProductsRepo.list()` for products any more; the port method is kept for the reserved supervision read.

**L5 — Evidence.** RED observed before the code: `DataProvider.test.tsx` 14/17 failing (every refresh assertion pointed at the old read) and `ProductPDFDocument.test.tsx` 2 failing (name hidden, count 1 instead of 2). GREEN after: `DataProvider.test.tsx` 17/17, `ProductPDFDocument.test.tsx` 3/3, full run 548/548 across 58 files, `pnpm lint` and `pnpm exec tsc -b` clean. Work units: `fix(data): scope the product catalog to the session owner` (`a7e811c`) and `fix(pdf): include unavailable products in the product price list` (`ed56e7f`).

**L6 — Known environmental failure (pre-existing, not caused by this change).** `pnpm exec playwright test` cannot run on this machine: every spec fails at `browserType.launch` with `Executable doesn't exist at /home/piwen/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell` — the pinned Playwright wants revision 1223 and the local cache only holds 1228/1234. The failure happens before the app is loaded, so it is independent of the diff; the CI job installs the browser itself (`pnpm exec playwright install --with-deps chromium`). The e2e principal is also `isAdmin: false` (`src/Root.tsx:37`), so the narrowed admin read is outside the e2e path either way. Fix if wanted: `pnpm exec playwright install chromium`.

**L7 — Independent verification (delegated, read-only).** A fresh `gentle-ai-verify` worker, handed this whole document and baseline `ae721ee`, ran probes in a scratch copy under `/tmp/opencode` and left the workspace untouched. Results per spec: **S1 PASS · S2 PASS · S3 PASS · S4 PASS · no blockers**. Change-causality: its own probes and the candidate's tests fail at baseline (admin snapshot observed as `Propio|Ajeno A|Ajeno B`) and pass at the candidate; the claimed RED (14 + 2) reproduced exactly at baseline; candidate suite 548/548, baseline 547/547 (no pre-existing failures). PDF evidence came from the real renderer (`pdf(...).toString()` + `pdftotext`), not the test mock: mixed and all-unavailable lists print every name, footer counts match; baseline printed `1 productos` and dropped the unavailable row. Vendor invariance holds (`list()` deep-equals `listOwn('vendor-1')`, mounted cache unchanged). Advisories (all pre-existing or comment-only): three docstrings still called the catalog "RLS-visible" — fixed in `401ccc5` *before* the review freeze, with lint, `tsc -b` and the full suite re-run green afterwards (comment-only, no behavior delta; the diff grows from 7 to 9 paths, so the verifier's path-set invariant covers the previous commit only). `ProductsRepo.list()` is now unused by the app and was kept on purpose (L4). RLS-principal equivalence is not locally verifiable (no live Supabase) and was verified structurally plus through the in-memory repo.
