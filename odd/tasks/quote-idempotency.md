# Feature: Idempotencia de cotizaciones en la base

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/quote-idempotency/tasks`.
> Issue #103. Decisión del usuario: **clave de intento** (`client_id` + `unique(owner_id, client_id)`), no huella de contenido.

Branch: `fix/quote-idempotency` (apilada sobre `fix/ui-load-states-and-pwa`, #106, porque ambas tocan `Cotizador.handleSave`)
Delivery strategy: un PR pequeño, apilado
Test runner: `pnpm test` (vitest)

## Specs

**S1 — Un reintento no duplica (#103).** Requisito verbatim:
> Acceptance
> - A retried save creates exactly one quote, with or without the UI guard.
> - The chosen residual case (deliberate identical save) is documented.
> - Existing quote reads and history behaviour are unchanged.

**S2 — Semántica elegida (clave de intento).** La app genera un `client_id` por **intento** de guardado y lo reutiliza mientras el intento no haya tenido éxito. La base tiene `unique (owner_id, client_id)`; un choque se trata como éxito, no como error. Residual documentado: dos guardados deliberados distintos (o dos pestañas) con la misma cotización siguen creando dos filas — son intentos distintos.

**S3 — La fila histórica no se rompe.** `client_id` es nullable: las filas anteriores a la migración quedan con `NULL`, y un índice único en Postgres considera distintos los `NULL`, así que no colisionan entre sí.

**S4 — El stub en memoria se comporta como producción.** Sin esto, el e2e (`VITE_E2E=1`) no ejercita la idempotencia y el test de UI no probaría nada real.

**S5 — No regresión.** Lecturas, historial, `quoteSignature` y el resto de la suite quedan iguales.

## Tasks

| ID | Specs | Tarea | Ruta | Estado |
|----|-------|-------|------|--------|
| T1 | S1, S2, S3 | Migración `client_id` + índice único + mapeo del insert. | inline | ✅ |
| T2 | S1, S2 | `quotesRepo.create` trata el choque de la clave como éxito. | inline | ✅ |
| T3 | S2 | `Cotizador` genera y reutiliza la clave por intento. | inline | ✅ |
| T4 | S4 | Stub en memoria con dedupe por `client_id`. | inline | ✅ |
| T5 | S1–S5 | Tests: repo, stub, UI con reintento. | inline | ✅ |

## Log

**L1** — 2026-10-21 — pedido, verbatim:
> DAle con la clave de intento para el #103

**L2** — 2026-10-21 — la migración no se puede verificar contra un Postgres real en esta sesión; la cubre el job de RLS de #92 cuando exista.

**L3** — 2026-10-21 — evidencia.
- RED observado en los cinco tests nuevos: el insert no llevaba `client_id`; el choque 23505 se propagaba como error; el stub creaba dos filas; la UI no generaba clave ni la reutilizaba.
- `quotesRepo`: clave en el insert, choque de la constraint `cotizaciones_owner_client_id_key` tratado como éxito (devuelve la forma guardada sin `id`), y otro 23505 sigue lanzando.
- `Cotizador`: reintento tras fallo reutiliza la clave; un guardado nuevo tras éxito usa una clave distinta.
- Stub en memoria: misma clave → una fila y el mismo id; claves distintas → dos filas.
- Índice parcial (`where client_id is not null`): no indexa filas históricas y sigue sirviendo de constraint.
- Suite completa: **673 tests verdes**, 88.57% statements. `tsc -b` y `eslint .` limpios.
- No verificado: la migración contra Postgres (sin stack local).

