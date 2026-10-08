# supabase-auth Specification

## Purpose

Email/password authentication for the five named salespeople, with a composition-root auth gate, Spanish login UI, and dashboard-provisioned accounts. Self-signup is disabled. The security boundary is Row Level Security; the gate is a UX boundary that keeps unauthenticated users out of the app shell.

## Requirements

### Requirement: Five provisioned equal-privilege accounts

The system MUST authenticate exactly the five named users via Supabase Auth email/password, all with equal privileges in Phase 1. Self-signup MUST be disabled and email confirmation MUST NOT be required. Accounts are created via the Supabase dashboard with manually delivered passwords on the `example.com` domain in region `southamerica-east1` (São Paulo).

Accounts:

- `admin@example.com` — admin
- `vendedor1@example.com` — Vendedor 1
- `vendedor2@example.com` — Vendedor 2
- `vendedor3@example.com` — Vendedor 3
- `vendedor4@example.com` — Vendedor 4

The `{inicial}{apellido}@example.com` pattern is descriptive of these five addresses, not a generative rule for future accounts.

#### Scenario: Named user signs in with email and password

- GIVEN a provisioned account `vendedor1@example.com` with its delivered password
- WHEN the user submits those credentials on the login screen
- THEN the system MUST establish an authenticated session and reveal the app

#### Scenario: Unknown address cannot sign in

- GIVEN an address that was never provisioned
- WHEN sign-in is attempted with any password
- THEN the system MUST reject the attempt and MUST NOT reveal whether the address exists

#### Scenario: Self-signup is unavailable

- GIVEN self-signup is disabled on the project
- WHEN a signup is attempted through any client path
- THEN the system MUST refuse to create the account

### Requirement: Auth gate at the composition root

The system MUST gate the entire application on authentication state. While the session status is `loading` the system MUST render a minimal spinner. When unauthenticated it MUST render the login screen instead of the app. When authenticated it MUST render the data providers and the app. An unauthenticated user MUST NOT be able to reach any product, quote, list-send, or import/export surface.

#### Scenario: First visit without a session shows only the login screen

- GIVEN no stored session
- WHEN the app boots
- THEN the login screen MUST be shown and no catalog, quote, or history content SHALL be visible

#### Scenario: Authenticated reload enters the app directly

- GIVEN a valid persisted session
- WHEN the app boots
- THEN the app MUST render without requiring credentials again

#### Scenario: Session expiry returns to the login screen

- GIVEN an authenticated session that expires or is revoked
- WHEN the auth state reports no session
- THEN the system MUST return to the login screen

### Requirement: Spanish login screen with safe error behavior

The system MUST provide an email/password login form in Spanish. On invalid credentials it MUST show a single generic error message that does not disclose whether the email or the password was wrong. The screen MUST NOT offer signup or password-reset paths in Phase 1; resets are performed from the dashboard.

#### Scenario: Successful login clears errors and enters the app

- GIVEN the login screen with valid credentials entered
- WHEN the user submits
- THEN the error area MUST be empty and the app MUST be shown

#### Scenario: Wrong password shows a generic message

- GIVEN the login screen and a correct email with an incorrect password
- WHEN the user submits
- THEN a generic invalid-credentials message MUST appear and the app MUST NOT be shown

#### Scenario: Empty fields are rejected client-side

- GIVEN the login form with an empty email or password
- WHEN the user submits
- THEN submission MUST be blocked with a validation message and no auth request SHALL be sent

### Requirement: Sign-out from the existing menu

The system MUST expose a "Cerrar sesión" item in the existing hamburger menu. Activating it MUST terminate the session and return to the login screen. This menu item and the login screen are accepted UI deltas; no other markup or copy change is authorized by this spec.

#### Scenario: User signs out from the menu

- GIVEN an authenticated session
- WHEN the user activates "Cerrar sesión"
- THEN the session MUST end and the login screen MUST be shown

#### Scenario: Signed-out session does not leak data

- GIVEN the user has just signed out
- WHEN the login screen is displayed
- THEN no previously loaded catalog, quote, or client data SHALL remain visible

### Requirement: Session lifecycle and single source of truth

The system MUST use the Supabase `onAuthStateChange` stream (including the initial session event) as the single source of truth for session state, with the client's default session persistence and token auto-refresh enabled. The auth adapter MUST expose `getSession`, `onAuthStateChange`, `signIn` (rejecting with a user-safe message), and `signOut`.

#### Scenario: Restored session survives a page reload

- GIVEN an authenticated session persisted by the client
- WHEN the page reloads
- THEN the gate MUST resolve to authenticated without prompting for credentials

#### Scenario: Sign-in failure surfaces a user-safe message

- GIVEN an auth backend failure or invalid credentials
- WHEN `signIn` rejects
- THEN the rejection MUST carry a generic user-safe message suitable for display on the login screen

### Requirement: Profile display names

The system MUST ensure every provisioned user has a `perfiles` row whose `nombre` is the person's display name (Admin, Vendedor 1, Vendedor 2, Vendedor 3, Vendedor 4), set via one documented `UPDATE` after dashboard provisioning. The auto-created fallback (metadata value or email prefix) MUST be replaced for these five accounts before go-live.

#### Scenario: Admin display name is correct before go-live

- GIVEN the five provisioned accounts
- WHEN profiles are listed
- THEN each email MUST map to its documented display name above

### Requirement: Environment configuration and key hygiene

The system MUST read the Supabase URL and anon/publishable key from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, with an explicit `VITE_E2E` switch for the stub backend. When configuration is missing outside stub mode, the system MUST render a small configuration-error screen instead of booting a broken app. The anon/publishable key is public by design (RLS is the boundary); the service-role key MUST never be embedded in or used by the app.

#### Scenario: Missing configuration blocks boot with an explanation

- GIVEN `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is unset and `VITE_E2E` is not active
- WHEN the app boots
- THEN a configuration-error screen MUST be shown and no data request SHALL be attempted

### Requirement: Testable auth without live credentials

The system MUST be verifiable without a live Supabase project: unit tests MUST run against a fake auth port, and Playwright MUST run against a stub auth (authenticated by default; a spec MAY set `localStorage['e2e:auth'] = 'off'` before load to assert the gate). No new CI job and no repository secrets are required in Phase 1. The `verify` (lint, `tsc -b`, `pnpm coverage` at 60/55/60/60) and `e2e` (`pnpm exec playwright test`) jobs MUST stay green.

#### Scenario: Gate states are unit-testable without a network

- GIVEN a fake auth port in each gate state
- WHEN the gate renders
- THEN loading shows a spinner, unauthenticated shows the login screen, and authenticated shows the app

#### Scenario: E2E can assert both sides of the gate deterministically

- GIVEN the stub backend active
- WHEN a spec sets `localStorage['e2e:auth'] = 'off'` before load
- THEN the login screen MUST appear; otherwise the app MUST appear authenticated

### Requirement: Hosting region and go-live gate

The Supabase project MUST live in `southamerica-east1` (São Paulo). The Free tier MUST be used for development and migration only: it provides no automatic backups and pauses after roughly one week idle. Real salesperson use MUST be gated on upgrading to Pro (owner: Piwen) or on an explicit signed-off exception; until then periodic manual v3 JSON exports remain the recovery path.

#### Scenario: Go-live is blocked while on Free without sign-off

- GIVEN the project is on the Free tier with no signed-off exception
- WHEN go-live readiness is assessed
- THEN the system MUST be treated as not ready for real salesperson use
