# Auth: password change + remember me

Branch: `feat/auth-password-remember` · Delivery: feature branch, work-unit commits · Runner: `pnpm test` (vitest)

## Specs

- **S1** — The login screen keeps the existing email/password fields and adds a `Recordarme` checkbox. It starts unchecked on a device that never chose, and reflects the last choice afterwards.
- **S2** — With `Recordarme` checked the Supabase session is stored in `localStorage`, so it survives closing the browser. Unchecked, the session is stored in `sessionStorage` and ends with the browser session.
- **S3** — The email is remembered only when `Recordarme` is checked: it is prefilled on the next visit and erased when the user submits unchecked.
- **S4** — The app never stores the user's password. Password saving stays delegated to the browser password manager through `autoComplete` attributes.
- **S5** — A logged-in user can open `Cambiar contraseña` from the options menu and submit current password, new password, and confirmation.
- **S6** — Validation: the new password must have at least 8 characters, match the confirmation, and differ from the current one. The submit button is disabled while the request is in flight.
- **S7** — A wrong current password shows `La contraseña actual no es correcta.`; a weak password and any other provider failure show safe Spanish messages. Raw provider messages are never surfaced.
- **S8** — On success the dialog closes and a `Contraseña actualizada.` toast is shown.
- **S9** — Existing behavior is preserved: sign in, sign out, the auth gate, repositories keyed by user id, and the e2e auth bypass.

## Tasks

| ID | Task | Specs | Route | Status |
| --- | --- | --- | --- | --- |
| T1 | Auth storage router (remember flag, email helpers) | S2, S3, S4 | inline | done (commit 2) |
| T2 | Login screen: checkbox, email prefill, flag before sign-in | S1, S2, S3 | inline | done (commit 2) |
| T3 | `changePassword` in port, provider, Supabase adapter | S5, S7 | inline | done (commit 1) |
| T4 | `ChangePasswordDialog` + menu entry + success toast | S5, S6, S8 | inline | done (commit 1) |
| T5 | Test doubles (`fakeAuth`, e2e auth) | S9 | inline | done (commit 1) |
| T6 | Tests: unit, component, wiring, e2e | S1-S9 | inline | done (commits 1-2) |

## Log

- **L1 (user, verbatim)** — `Vamos a planificar agregar el cambio de contraseña para los usuarios y tambien el boton de recordarme( recordar usuari y contraseña).`
- **L2 (user, verbatim)** — `a` — chosen semantics: remember the email plus choose whether the session survives the browser closing (`sessionStorage` by default, `localStorage` when checked).
- **L3 (decision)** — Storing the password in web storage is rejected: XSS-readable and redundant with the browser password manager. `autoComplete` already delegates credential saving.
- **L4 (decision)** — Explicit `storageKey: 'produclist-auth'` so a preference change can deterministically delete the token from the abandoned storage.
- **L5 (RED → GREEN)** — New tests were written first: `authStorage.test.ts`, `ChangePasswordDialog.test.tsx`, additions to `LoginScreen.test.tsx`, `supabaseAuth.test.ts`, `AuthProvider.test.tsx`, `fakeAuth.test.ts`, `Root.wiring.test.tsx`, `client.test.ts` and `e2e/auth.spec.ts`. RED run: 12 failed / 50 passed across 8 files (missing module exports and functions). After implementation: 614/614 unit tests pass.
- **L6 (verification)** — `pnpm vitest run` 63 files / 614 tests green; `pnpm build` (tsc -b + vite build) green; `pnpm lint` clean; `pnpm playwright test e2e/auth.spec.ts` 8/8 green on both mobile projects.
- **L7 (note)** — The new `storageKey` means sessions persisted under the old default key are not read after deploy: every user signs in once after the update. Accepted in exchange for a deterministic storage policy.
- **L8 (note)** — Password changes re-authenticate with `signInWithPassword` before `updateUser`. That consumes a login attempt but proves ownership and refreshes the session; `updateUser` alone does not verify the current password.
