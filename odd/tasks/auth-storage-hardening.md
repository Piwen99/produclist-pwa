# Auth storage hardening (#79)

Branch: `fix/auth-storage-hardening` · Delivery: feature branch, work-unit commits · Runner: `pnpm test` (vitest)

## Specs

- **S1** — With Web Storage throwing on read or write, the app still mounts and the login form still signs in.
- **S2** — Every key matching `^sb-.*-auth-token$` is removed from `localStorage` and `sessionStorage` on startup, and `produclist-auth`, `auth:remember`, and `auth:last-email` are untouched.
- **S3** — A storage failure is never presented to the user as `Correo o contraseña incorrectos.`
- **S4** — With healthy storage, the existing routing (`sessionStorage` by default, `localStorage` when `auth:remember === '1'`), the single-copy token invariant, and the email helpers behave exactly as before.
- **S5** — In degraded mode the session lives in memory for the current tab and is not persisted; no exception escapes the storage layer.
- **S6** — The legacy cleanup is idempotent: running it on every launch is safe and needs no version flag.

## Tasks

| ID | Task | Specs | Route | Status |
| --- | --- | --- | --- | --- |
| T1 | Safe storage wrapper with shared in-memory fallback | S1, S3, S5 | inline | done |
| T2 | Legacy `sb-*-auth-token` cleanup on startup | S2, S6 | inline | done |
| T3 | Route auth storage and email helpers through the safe wrapper | S3, S4, S5 | inline | done |
| T4 | Tests: throwing storage, blocked mount, legacy cleanup, regressions | S1-S6 | inline | done |

## Log

- **L1 (user, verbatim)** — `si arranca por el #79`
- **L2 (issue)** — #79 `fix(auth): harden session storage against legacy keys and unavailable Web Storage`. Root cause: the storage layer assumes healthy Web Storage and a fresh key.
- **L3 (decision)** — The in-memory fallback is per raw `Storage` object, shared across calls through a `WeakMap`, so the flag written by the login screen is visible to the client's storage adapter without a new global state.
- **L4 (decision)** — The legacy cleanup matches only `sb-*-auth-token`; the PKCE code-verifier key is harmless and out of scope.
- **L5 (RED → GREEN)** — Tests written first: safe storage reader/writer, blocked read/write, recovery after a later successful write, hidden unremovable value, shared fallback across wrappers, legacy cleanup idempotency, degraded `createAuthStorage`, degraded login, wiring cleanup. RED: 15 failed / 27 passed across 3 files.
- **L6 (verification)** — Focused 42/42; full `pnpm vitest run` 63 files / 630 tests; `pnpm build` green; `pnpm lint` clean; `pnpm playwright test e2e/auth.spec.ts` 8/8.
- **L7 (note)** — In degraded mode the fallback lives only in memory for the tab; nothing is persisted, and a later successful write returns the key to the real storage. A value that cannot be removed is hidden from the app but may remain on disk; that is the best effort available when the browser refuses the delete.
