# Feature: Resiliencia y observabilidad de auth

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/auth-resilience/tasks`.
> Lane B del plan de issues abiertos (#86 → #85 → #88 → #87 → #89). Las lanes de dinero/UI/CI no entran acá.

Branch: `fix/auth-resilience` (desde `master` @ 399073f)
Delivery strategy: `ask-on-risk` — forecast ~450–600 líneas autoradas → cadena de 2 PRs si se supera
Test runner: `pnpm test` (vitest)

## Specs

**S1 — Cada fallo de auth tragado deja un diagnóstico (#86).** Requisito verbatim:
> Acceptance
> - Every swallowed auth failure emits exactly one diagnostic with no secrets.
> - The diagnostic is easy to route to a real sink later without touching the storage layer.
> - The README names how to verify the provider toggle is on.

El hook es genérico (`src/utils/diagnostics.ts`), no auth-scoped: es el prerequisito compartido de #85, #88 y del fallback de #90.

**S2 — Sign-out no puede dejar el token usable en disco (#85).** Requisito verbatim:
> Acceptance
> - After sign-out, a fresh wrapper never reads a usable token when any write path works.
> - The impossible case (delete and overwrite both rejected) is observable and documented.
> - Existing single-copy and legacy-cleanup tests stay green.

**S3 — Un request colgado no puede encerrar al usuario en el modal (#88).** Requisito verbatim:
> Acceptance
> - A hung request cannot trap the user in the modal.
> - The transport cause is recorded without leaking secrets to the user.
> - Existing lifecycle tests stay green.

**S4 — Sesión expirada lleva al login en un paso (#87).** Requisito verbatim:
> Acceptance
> - An expired/revoked session never shows "Intenta de nuevo".
> - The user reaches the login screen or a message with a runnable path in one step.
> - Existing mappings stay green.

Decisión: en `session_not_found`, `session_expired`, `AuthSessionMissingError` y `reauthentication_needed` se hace `signOut()` best-effort y se lanza `REAUTHENTICATION_MESSAGE`. Reintentar con la misma sesión muerta no puede funcionar.

**S5 — Cerrar los gaps de tests del batch de auth (#89).** Requisito verbatim:
> Acceptance
> - Every gap above has a named test.
> - Where the test targets a previous defect, it fails against the pre-fix implementation.
> - The full suite stays green.

Se descarta el bullet "provider-ignores-field success path": ya está pinneado en `supabaseAuth.test.ts:197-210`; solo se renombra para nombrar la asunción.

**S6 — No regresión.** Los mapeos de error actuales, el almacenamiento con/sin "Recordarme" y el contrato de `AuthPort` quedan iguales.

## Tasks

| ID | Specs | Tarea | Ruta | Estado |
|----|-------|-------|------|--------|
| T1 | S1 | `src/utils/diagnostics.ts` + call sites en `authStorage`/`supabaseAuth` + nota de verificación del toggle en README. | inline | ✅ `d54b1e1` |
| T2 | S2 | `createSafeStorage.removeItem` con fallback `setItem('')`; diagnóstico solo si ambos fallan. | inline | ✅ `d54b1e1` |
| T3 | S3 | Timeout de 15 s en `attempt()`, settle único, resolución tardía ignorada, causa logueada. | inline | ✅ (commit 2) |
| T4 | S4 | `isSessionInvalid` (códigos GoTrue + `AuthSessionMissingError`) y sign-out en reautenticación. | inline | ✅ (commit 2) |
| T5 | S5 | Gaps de tests de storage, ciclo de contraseña y mapeos del provider. | inline | ✅ (commit 2) |

## Log

**L1** — 2026-10-21 — pedido, verbatim:
> Sigue primero con el PR en su propia branch y despues sigue con lane B

**L2** — 2026-10-21 — Lane A entregada como PR #99 (`fix/money-quote-contract`). Lane B arranca desde `master`, superficies disjuntas.

**L3** — 2026-10-21 — evidencia de verificación.
- #86: read/write/legacy-cleanup bloqueados emiten **un** `console.warn` con tag `[auth]` y sin el valor almacenado; una operación sana no emite nada. RED observado (0 llamadas) antes del wiring.
- #85: con `removeItem` rechazado, la clave queda en `''` y un wrapper nuevo lee `null`; con delete y overwrite rechazados queda una sola alerta `storage-remove-failed` y la pestaña sigue deslogueada. RED observado (`'value'` en vez de `''`).
- #88: request colgado rechaza a los 15 s con el mensaje seguro y un solo diagnóstico (`reason: 'TimeoutError'`); una resolución posterior al timeout no corre el camino de éxito. RED observado (el test colgaba 5 s y la resolución tardía ganaba).
- #87: `session_expired`, `session_not_found` y `AuthSessionMissingError` mapean a `REAUTHENTICATION_MESSAGE` y llaman `signOut()` una vez; un fallo del sign-out no tapa el mensaje. Precedencia fijada: un error que nombra la contraseña actual **no** desloguea.
- #89: 10 tests nuevos (multi-clave legacy, `auth:last-email` intacto, read-back con storage bloqueado, login rechazado degradado, limpieza parcial diagnosticada, memoria compartida entre clientes sin storage, alerta de contraseña actual, no-replay al reabrir, variantes message-only, solapamiento, inputs vacíos) y rename del test de "el provider ignora el campo".
- Suite completa: verde (662 tests, 63 archivos) en las corridas limpias; `tsc -b` y `eslint .` limpios.
- **Flake preexistente detectado, no causado por esta lane**: los tests de carga diferida de PDF (`QuotePDFButton`/`PDFButton`) fallan intermitentemente por timeout bajo carga paralela. Se reprodujo sin tocar esos archivos y pasan en aislamiento. Candidato a `test/deflake`.
- No verificado: nada de esta lane toca Postgres ni red real; el timeout se prueba con fake timers.

