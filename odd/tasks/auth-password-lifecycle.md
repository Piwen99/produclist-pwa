# Own the password-change request lifecycle (#80)

Branch: `fix/auth-request-lifecycle` · Delivery: feature branch, work-unit commits · Runner: `pnpm test` (vitest)

## Specs

- **S1** — While a password change is in flight the dialog cannot be dismissed: Cancel is disabled, a backdrop click does nothing, and Escape does nothing.
- **S2** — A second submit while one is in flight does not call the port again; reopening cannot replay a stale request.
- **S3** — A transport rejection from the provider (network, abort, unexpected throw) is mapped to `No se pudo actualizar la contraseña. Intenta de nuevo.` and never surfaces raw text.
- **S4** — The exact 8-character boundary is pinned: 7 characters are rejected client-side and 8 are accepted.
- **S5** — An empty current password never reaches the port.
- **S6** — Existing behavior is preserved: wrong current password, weak password, and same-password mappings; success closes the dialog and shows `Contraseña actualizada.`

## Tasks

| ID | Task | Specs | Route | Status |
| --- | --- | --- | --- | --- |
| T1 | Guard dismissal and duplicate submit in the dialog | S1, S2 | inline | done |
| T2 | Map transport rejections in the Supabase adapter | S3 | inline | done |
| T3 | Tests: boundary, empty current, in-flight dismissal, network mapping | S1-S6 | inline | done |

## Log

- **L1 (user, verbatim)** — `sigue con el 80`
- **L2 (issue)** — #80 `fix(auth): own the password-change request lifecycle`.
- **L3 (decision)** — Reuse the existing `submitting` state for both the dismissal guard and the duplicate-submit guard; no new state or flag.
- **L4 (decision)** — The adapter maps only thrown rejections (`attempt()` helper). Provider-reported errors keep their specific safe messages.
- **L5 (RED → GREEN)** — Tests first: 7-character rejection, 8-character acceptance, empty current password, in-flight dismissal (Cancel, backdrop, Escape), duplicate submit through a direct form submit, and thrown session/sign-in/update rejections. RED: 5 failed / 30 passed across 2 files.
- **L6 (verification)** — Focused 35/35; full `pnpm vitest run` 63 files / 641 tests; `pnpm build` green; `pnpm lint` clean; `pnpm playwright test e2e/auth.spec.ts` 8/8.
- **L7 (note)** — The submit button was already disabled in flight; what was missing was the dismissal guard, the duplicate-submit guard, and safe handling of thrown transport rejections. The dialog reports `aria-busy` while the request is pending.
- **L8 (independent verification)** — Verifier verdict: PASS WITH ADVISORIES, 0 blockers. Baseline `b54be05` failed all S1/S2/S3 probes (23/25 pass at HEAD vs 15/25 at baseline). The S5 advisory (a programmatically dispatched submit bypasses the native `required` and sent an empty current password) was fixed with an explicit guard and a regression test. Whitespace-only passwords are left to the provider: a password may legitimately contain spaces and must not be trimmed. After the correction: 63 files / 642 tests, build, lint, and e2e 8/8 green.
- **L9 (native review)** — Lineage `review-e2c160dc1ae737e5` (risk, resilience, reliability) approved and acknowledged; authority burned. Four informational findings, no correction:
  - `R4-no-bounded-wait-in-flight`: a provider promise that never settles leaves the modal undismissable; no timeout or `AbortController`. The dismissal block is S1's requested behavior; a bounded wait is a follow-up.
  - `R4-transport-cause-discarded`: `attempt()` uses a bare catch with no logging, so a real outage leaves no diagnostic signal.
  - `R3-empty-error-assertion`: the empty-current tests assert the port was not called but not the visible message.
  - `R3-reopen-replay-unproved`: reopening resets state by remounting (`App.tsx` mounts the dialog only while open), but no test pins it.
