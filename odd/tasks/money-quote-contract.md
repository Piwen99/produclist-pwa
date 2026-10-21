# Feature: Contrato de líneas y dinero de la cotización

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/money-quote-contract/tasks`.
> Lane A del plan de issues abiertos (#95 → #94 → #90 → #96). Las otras lanes (auth, UI, CI) no entran acá.

Branch: `fix/money-quote-contract` (desde `master` @ 399073f)
Delivery strategy: `ask-on-risk` — forecast ~650–800 líneas autoradas → pedir estrategia de cadena antes del 2.º commit
Test runner: `pnpm test` (vitest) + `pnpm exec playwright test` (e2e)

## Specs

**S1 — Las líneas impresas suman el subtotal impreso (#95).** Requisito verbatim del issue #95:
> Acceptance
> - On any quote, the printed line amounts add up exactly to the printed subtotal.
> - The cart and the PDF show the same numbers.
> - Plan: "Pick one rounding contract and apply it everywhere: either round each line to the displayed precision and sum the rounded lines, or display the lines with the precision the subtotal uses."
> - Plan: "Keep the IVA and the total derived from the same rounded base, so the three printed numbers are internally consistent."

Contrato elegido (decisión aceptada por el usuario): cada línea se redondea al peso; el subtotal es la suma de las líneas redondeadas; `iva = Math.round(subtotal × 0,19)`; `total = subtotal + iva`.

**S2 — Una sola implementación del cálculo.** `useQuote`, carrito (`QuoteItem`), PDF (`QuotePDFDocument`) y texto de compartir (`QuoteShareButton`) consumen el mismo módulo. Hoy hay cuatro copias y el share usa `parseFloat` sin validar.

**S3 — El formato de producto es obligatorio (#94).** Requisito verbatim del issue #94:
> Acceptance
> - A product cannot reach a saved quote with a silently zero-priced line, or the line is explicitly marked as invalid everywhere it is rendered.
> - The comment in `useQuote` matches the code.
> - Existing products with an empty format keep working, or are migrated with a documented decision.

Regla elegida (decisión aceptada por el usuario), en capas:
- Entrada: `ProductForm` exige `formato` no vacío y en formato chileno; la DB agrega un `check` **`NOT VALID`** para no romper filas históricas.
- Filas históricas con `formato = ''` siguen leyéndose, pero se marcan como línea inválida en carrito, PDF y share, y bloquean guardar/enviar hasta corregir el producto.

**S4 — El borrador es por usuario (#90).** Requisito verbatim del issue #90:
> Acceptance
> - A draft saved by one user is never loaded by another user on the same device.
> - Signing out removes the persisted draft.
> - A blocked `localStorage` accessor does not crash the cotizador.

**S5 — El import valida ítems y totales (#96).** Requisito verbatim del issue #96:
> Acceptance
> - A backup with a malformed item or a non-numeric total is reported in the preview and is not written.
> - A valid backup imports exactly as before.

Se acepta el formato de backup válido tal cual: no se exige consistencia entre `items` y los totales guardados (los backups viejos tienen los totales calculados con el redondeo anterior).

**S6 — No regresión.** Las cotizaciones válidas conservan sus montos; los tests existentes de `useQuote`, `QuoteItem`, `QuotePDFDocument`, `QuoteShareButton`, `Cotizador` y `exportImport` siguen verdes salvo los que pinean explícitamente un defecto (se invierten a propósito y quedan documentados en el Log).

## Tasks

| ID | Specs | Tarea | Ruta | Estado |
|----|-------|-------|------|--------|
| T1 | S1, S2 | `src/utils/quoteMath.ts`: `lineKg`, `lineSubtotal`, `invalidLines`, `computeQuoteTotals`; redondeo por línea; migrar los cuatro consumidores. | inline | ✅ `3fad792` |
| T2 | S3 | `ProductForm` formato obligatorio + migración `not valid` + línea inválida visible + bloqueo de guardar/PDF + comentario de `useQuote`. | inline | ✅ `564b1c1` |
| T3 | S4 | `draftsRepo` con clave por usuario y fallback a memoria; `useQuote(userId)`; limpieza en sign-out y cambio de usuario. | inline | ✅ `ab0453f` |
| T4 | S5 | `parseQuoteItem` valida ítem por ítem, totales finitos y reporta al `errors` del preview. | inline | ✅ `39b2929` |

## Log

**L1** — 2026-10-21 — pedido original, verbatim:
> revisa los issues abierto y sus comentarios. Planifica las correcciones

**L2** — 2026-10-21 — arranque, verbatim:
> arranca por tu orden de impacto

**L3** — 2026-10-21 — decisión de arranque. El plan original de la Lane A decía `#94 → #95`; al leer el código, el predicado de validez (`¿este formato se puede tarifar?`) **es** el primer ladrillo del cálculo. Se invierte el orden: T1 (#95) centraliza la matemática y deja `lineKg() → number | null`; T2 (#94) aplica la política sobre ese predicado. Evita escribir dos veces el mismo helper.

**L4** — 2026-10-21 — evidencia de verificación (T1–T4).
- `quoteMath`: 12 tests; el caso del issue (`11,33 × $1001` ×2) da subtotal `22.682`, IVA `4.310`, total `26.992`. Antes del fix, `useQuote` devolvía `22682.66` (RED observado).
- `ProductForm`: el test que pineaba el defecto ("no valida formato vacío" → `onSubmit` llamado) se invirtió a "El formato es obligatorio"; RED observado antes de implementar.
- `Cotizador`: carrito con línea sin formato → `role="alert"` con el nombre del producto, guardar no escribe (0 cotizaciones), PDF deshabilitado.
- `draftsRepo`: clave por usuario, `clearDraftFor`, acceso bloqueado y operación suelta que falla → degradación a memoria sin excepción.
- Sign-out: test de integración en `App.nav.test.tsx`; se verificó el RED quitando la llamada a `clearDraftFor` en `App.tsx` (la clave sobrevive) y restaurándola.
- `exportImport`: 7 tests nuevos (total no numérico, precio no numérico, `cantidad` faltante, `formato` numérico, `formato` vacío, precio negativo, preview + apply no escriben la entrada mala). RED observado en los 7.
- Suite completa: 667 tests verdes, `tsc -b` limpio, `eslint .` limpio.
- No verificado: la migración SQL no se aplicó contra un Postgres real (no hay stack local en esta sesión). Queda cubierta por #92.

**L5** — 2026-10-21 — hallazgo fuera de alcance, no corregido: `parseQuoteItem` (antes y ahora) **descarta `cliente`** al importar, así que un backup restaurado pierde el nombre del cliente de cada cotización. No entra en #96; candidato a issue propio.

