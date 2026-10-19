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
| T1 | Auth storage router (remember flag, email helpers) | S2, S3, S4 | inline | pending |
| T2 | Login screen: checkbox, email prefill, flag before sign-in | S1, S2, S3 | inline | pending |
| T3 | `changePassword` in port, provider, Supabase adapter | S5, S7 | inline | pending |
| T4 | `ChangePasswordDialog` + menu entry + success toast | S5, S6, S8 | inline | pending |
| T5 | Test doubles (`fakeAuth`, e2e auth) | S9 | inline | pending |
| T6 | Tests: unit, component, wiring, e2e | S1-S9 | inline | pending |

## Log

- **L1 (user, verbatim)** — `Vamos a planificar agregar el cambio de contraseña para los usuarios y tambien el boton de recordarme( recordar usuari y contraseña).`
- **L2 (user, verbatim)** — `a` — chosen semantics: remember the email plus choose whether the session survives the browser closing (`sessionStorage` by default, `localStorage` when checked).
- **L3 (decision)** — Storing the password in web storage is rejected: XSS-readable and redundant with the browser password manager. `autoComplete` already delegates credential saving.
- **L4 (decision)** — Explicit `storageKey: 'produclist-auth'` so a preference change can deterministically delete the token from the abandoned storage.
