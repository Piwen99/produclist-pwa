# Enforce the current password at the provider (#81)

Branch: `feat/auth-provider-current-password` · Delivery: feature branch, work-unit commits · Runner: `pnpm test` (vitest)

## Specs

- **S1** — `changePassword` sends `current_password` in `updateUser({ current_password, password })`. It does not call `signInWithPassword` or `getSession` first.
- **S2** — A provider `current_password_mismatch` maps to `La contraseña actual no es correcta.`
- **S3** — A provider `reauthentication_needed` maps to `Por seguridad, volvé a iniciar sesión y volvé a intentar.` — a runnable exit, without a nonce UI.
- **S4** — The weak, same-password, unknown-error, and thrown-transport mappings are preserved.
- **S5** — `supabase/config.toml` declares `secure_password_change = true`; the README documents the production toggle and the rollout order.
- **S6** — Rollout order: deploy this code first, then enable Secure password change in production. The code alone does not enforce anything; the setting alone would reject the previous implementation because it never sent `current_password`.

## Tasks

| ID | Task | Specs | Route | Status |
| --- | --- | --- | --- | --- |
| T1 | Send `current_password` and drop the client-side re-authentication | S1, S2 | inline | done |
| T2 | Map `reauthentication_needed` to a safe re-login message | S3 | inline | done |
| T3 | Declare and document the provider setting | S5, S6 | inline | done |
| T4 | Tests: payload, mappings, no extra calls | S1-S4 | inline | done |

## Log

- **L1 (user, verbatim)** — `Dale hazlo`
- **L2 (issue)** — #81 `feat(auth): enforce the current password at the provider when changing it`.
- **L3 (decision)** — The installed auth-js 2.117.3 declares `UserAttributes.current_password` and `_updateUser` forwards attributes verbatim, so the snake_case key is what GoTrue receives. The public camelCase variant described in a community thread does not apply to this version; verified against `node_modules`.
- **L4 (decision)** — `updateUser` is called without `email` to avoid triggering an email-change flow; the provider identifies the user by the JWT.
- **L5 (decision)** — The 24-hour reauthentication nonce UI is out of scope. `reauthentication_needed` is mapped to a self-service re-login message instead of a dead end.
- **L6 (rollout)** — Production must enable `Secure password change` (Auth → Providers → Email, `auth.email.secure_password_change`) immediately after this deploy. Until then the provider ignores `current_password`; the app no longer verifies it client-side.
- **L7 (RED → GREEN)** — Tests first: payload assertion, no `getSession`/`signInWithPassword`, `current_password_mismatch`, `reauthentication_needed`. RED: 4 failed / 17 passed (the weak/same tests also failed while the old pre-step short-circuited first).
- **L8 (verification)** — `pnpm vitest run` 63 files / 640 tests; `pnpm build` green; `pnpm lint` clean; `pnpm playwright test e2e/auth.spec.ts` 8/8.
- **L9 (note)** — Live provider enforcement cannot be verified locally: it requires the hosted project with the setting enabled. Local verification covers the outgoing payload and every error mapping; the manual check is a wrong current password against production after the toggle.
- **L10 (independent verification)** — Verifier verdict: PASS WITH ADVISORIES, 0 blockers. A wire probe through the installed supabase-js 2.117.3 captured exactly one `PUT /user` whose body contained `current_password` verbatim, with no `/token` round-trip. `current_password_mismatch` and `reauthentication_needed` mapped to the exact safe messages; weak/same/unknown/thrown mappings held. The README now names the deploy-then-enable rollout order. Live GoTrue behavior remains unverified until the production toggle is on.
