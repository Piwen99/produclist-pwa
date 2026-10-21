# Feature: Estados de carga y PWA

> ODD feature document. Single topic: this file. Mirror in Engram: `odd/ui-load-states-and-pwa/tasks`.
> Lane C del plan de issues abiertos (#91 → #97). Las lanes de dinero/auth/CI no entran acá.

Branch: `fix/ui-load-states-and-pwa` (desde `master` @ 399073f)
Delivery strategy: `ask-on-risk` — forecast ~450–550 líneas autoradas → un PR para la lane
Test runner: `pnpm test` (vitest) + `pnpm exec playwright test` (e2e)

## Specs

**S1 — Un load fallido nunca se ve como vacío (#91).** Requisito verbatim:
> Acceptance
> - A failed read never renders an empty state, and every failed read offers a retry.
> - A double tap on any write button issues exactly one request.
> - The existing suite stays green.

**S2 — Guard in-flight reutilizando el patrón existente (#91).** `ListSends.tsx:126-161` es la referencia (`loadError` + "Reintentar"); `LoginScreen`, `ChangePasswordDialog`, `PDFButton`, `QuotePDFButton` y el retry de `ListSends` ya deshabilitan mientras hay request. No se inventa un patrón nuevo. Fuera de alcance: vaciar el carrito después de guardar (decisión de producto; el comentario del issue lo saca).

**S3 — Banner de instalación persistente y sin tapar el FAB (#97).** Requisito verbatim:
> Acceptance
> - The banner does not reappear after a dismissal.
> - The PDF button stays tappable while the banner is visible.
> - Android installs a maskable icon.

**S4 — Icono maskable con zona segura real (#97).** No alcanza con declarar `purpose: "maskable"`: el arte tiene que quedar dentro del ~80% central o Android lo recorta. El asset se genera desde `public/pwa-512x512.png` (fondo verde plano) escalando el arte y rellenando el fondo.

**S5 — No regresión.** Las 5 pestañas, la navegación móvil y el resto de la suite quedan iguales.

## Tasks

| ID | Specs | Tarea | Ruta | Estado |
|----|-------|-------|------|--------|
| T1 | S1, S2 | #91: estado de error + reintento en `ClientPrices`, `QuoteHistory` y el catálogo; guard in-flight en `Cotizador` y `ProductForm`. | delegado (worker) | pendiente |
| T2 | S3 | #97: persistir el dismissal del banner, separar banner y FAB, z-index explícito, e2e de no-intersección. | inline | pendiente |
| T3 | S4 | #97: `pwa-512x512-maskable.png` + `purpose` en el manifest. | inline | pendiente |

## Log

**L1** — 2026-10-21 — pedido, verbatim:
> Realiza los PRs correspondientes y despues sigue con Lane C

**L2** — 2026-10-21 — PRs de los candidatos: #104 (#101, `cliente` en el import), #105 (#102, estabilidad de queries async). #103 (idempotencia de cotizaciones) queda como issue sin PR: hay una decisión de producto abierta (clave de intento vs huella de contenido).
