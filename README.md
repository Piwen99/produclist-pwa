# Produclist — Lista de Precios PWA

Aplicación web progresiva (PWA) para gestionar una lista editable de precios de productos alimenticios, armar cotizaciones y registrar los precios indicados a cada cliente. Mobile-first, sin backend y con funcionamiento 100% offline: todos los datos viven en IndexedDB dentro del navegador.

## Características

### Productos
- **Lista editable** — agregar, editar y eliminar productos; el precio bruto se calcula automáticamente.
- **Disponibilidad por producto** — cada producto se puede marcar como disponible o no disponible.
- **Búsqueda y filtro** — búsqueda por nombre (atajo `Ctrl+/` o `Cmd+/`) y filtro "Solo disponibles".
- **Agrupación por categoría** — secciones colapsables con conteo de productos y disponibles, ordenadas alfabéticamente dentro de cada categoría.
- **Categorías** — Frutos Secos, Semillas/Cereal, Fruta Deshidratada y Legumbres.

### Cotizador
- **Armado de cotización** — selección de productos, cantidad y precio por kg editables.
- **Totales en vivo** — total de kg, subtotal neto, IVA 19% y total a pagar.
- **Cliente opcional** — nombre de cliente con autocompletado a partir de los nombres ya usados.
- **Borrador autoguardado** — la cotización en curso se persiste con debounce (800 ms) y sobrevive a un refresh.
- **Compartir** — copiar al portapapeles, enviar por WhatsApp y compartir con la Web Share API (cuando está disponible).

### Historial y clientes
- **Historial de cotizaciones** — cotizaciones guardadas ordenadas de la más reciente a la más antigua, con detalle de ítems, totales y opción de eliminar.
- **Listas enviadas** — snapshot de los precios actuales de los productos disponibles, asociado a un cliente (los precios se congelan tal como se informaron).
- **Clientes** — para cada cliente, el último precio indicado por producto, consolidando listas enviadas y cotizaciones, con fecha y origen.

### Respaldo y datos
- **Exportación JSON** — descarga un backup con productos y cotizaciones (`produclist-backup-aaaa-mm-dd.json`).
- **Importación con confirmación** — el archivo se valida y se compara contra la base antes de escribir nada (vista previa); recién se aplica al confirmar. Acepta el formato de backup v2 y también el formato v1 (arreglo simple de productos).
- **Respaldo automático previo** — si la importación va a actualizar productos existentes, se descarga un backup del estado actual antes de aplicar cambios.
- **Recordatorio de respaldo** — aviso cuando pasan 14 días sin exportar, con opción de posponerlo 3 días.

### Exportación a PDF e instalación
- **PDF de lista de precios** — `@react-pdf/renderer`, A4 horizontal, agrupado por categoría e incluyendo solo los productos disponibles. Columnas: producto (con formato), precio neto, precio bruto y total. Archivo `lista-precios-aaaa-mm-dd.pdf`.
- **PWA instalable** — manifest y service worker (`vite-plugin-pwa`), con banner de instalación para Android Chrome.

### Interfaz
- Notificaciones tipo toast (éxito, error, info y advertencia).
- `ErrorBoundary` con pantalla de error y recuperación.
- Estilos adaptables al modo oscuro según la preferencia del sistema.

## Tech Stack

| Dependencia | Versión | Uso |
|-------------|---------|-----|
| React + React DOM | ^19.2.6 | UI |
| Vite | ^8.0.12 | Build y servidor de desarrollo |
| TypeScript | ^5.8.0 | Tipado estático |
| TailwindCSS | ^4.3.0 | Estilos |
| React Router | ^7.15.1 | Ruteo de vistas |
| Dexie | ^4.4.2 | Acceso a IndexedDB |
| dexie-react-hooks | ^4.4.0 | Consultas reactivas (`useLiveQuery`) |
| @react-pdf/renderer | ^4.5.1 | Generación del PDF |
| vite-plugin-pwa | ^1.3.0 | Service worker y manifest |
| Vitest | ^4.1.6 | Tests unitarios |
| @testing-library/react | ^16.3.2 | Testing de componentes |
| Playwright | ^1.60.0 | Tests end-to-end |

## Scripts

| Comando | Acción |
|---------|--------|
| `pnpm dev` | Servidor de desarrollo de Vite |
| `pnpm build` | Chequeo de tipos (`tsc -b`) y build de producción |
| `pnpm lint` | ESLint sobre el proyecto |
| `pnpm preview` | Sirve el build de producción |
| `pnpm test` | Vitest en **modo watch** |
| `pnpm coverage` | Vitest en modo run con reporte de cobertura (v8) |

> `pnpm test` queda escuchando cambios. Para una corrida única (como en CI), usar `pnpm exec vitest run`.

## Estructura del proyecto

```
produclist/
├── .github/workflows/ci.yml     # CI: lint, typecheck, unit tests y e2e
├── e2e/                         # Tests end-to-end (Playwright)
├── public/                      # Íconos PWA (favicon, 192x192, 512x512)
├── src/
│   ├── components/              # Componentes de UI
│   │   ├── ProductList.tsx          # Lista, búsqueda y filtro
│   │   ├── CategoryGroup.tsx        # Sección colapsable por categoría
│   │   ├── ProductRow.tsx           # Fila de producto
│   │   ├── ProductForm.tsx          # Modal de alta/edición
│   │   ├── Cotizador.tsx            # Armado de cotizaciones
│   │   ├── QuoteItem.tsx            # Ítem de cotización
│   │   ├── QuoteProductSelector.tsx # Selector de producto para cotizar
│   │   ├── QuoteShareButton.tsx     # Copiar/WhatsApp/compartir
│   │   ├── QuoteHistory.tsx         # Historial de cotizaciones
│   │   ├── ClientPrices.tsx         # Precios por cliente
│   │   ├── ListSendForm.tsx         # Guardar lista enviada
│   │   ├── PDFButton.tsx            # Botón flotante de PDF
│   │   ├── ConfirmDialog.tsx        # Diálogo de confirmación
│   │   ├── BackupReminder.tsx       # Recordatorio de respaldo
│   │   ├── InstallPrompt.tsx        # Banner de instalación PWA
│   │   ├── Toast.tsx                # Notificación
│   │   ├── ErrorBoundary.tsx        # Captura de errores de render
│   │   └── ErrorFallback.tsx        # Pantalla de error
│   ├── db/
│   │   ├── database.ts          # Schema Dexie (products, quotes, drafts, listSends)
│   │   └── seed.ts              # 44 productos iniciales
│   ├── hooks/
│   │   ├── useProducts.ts       # Productos reactivos (useLiveQuery)
│   │   ├── useAddProduct.ts     # Alta de producto
│   │   ├── useUpdateProduct.ts  # Edición de producto
│   │   ├── useDeleteProduct.ts  # Baja de producto
│   │   ├── useQuote.ts          # Estado y totales del cotizador + autosave
│   │   ├── useToast.ts          # Contexto de toasts
│   │   └── ToastProvider.tsx    # Proveedor de toasts
│   ├── pdf/
│   │   ├── ProductPDFDocument.tsx  # Documento PDF
│   │   └── pdfFilename.ts          # Nombre del archivo PDF
│   ├── types/
│   │   ├── product.ts           # Product, ProductInput, Category
│   │   ├── quote.ts             # QuoteItem, QuoteTotals
│   │   └── listSend.ts          # ListSend, ListSendItem
│   ├── utils/
│   │   ├── price.ts             # Cálculo y formato de precios
│   │   ├── exportImport.ts      # Export/import de backup JSON
│   │   ├── listSend.ts          # Snapshot de precios para listas enviadas
│   │   ├── clientTracking.ts    # Último precio por cliente
│   │   └── backupReminder.ts    # Estado del recordatorio de respaldo
│   ├── test-setup.ts            # Setup de Vitest
│   ├── App.tsx                  # Rutas y composición de la app
│   ├── App.css                  # Estilos de la app
│   ├── index.css                # Estilos globales y Tailwind
│   ├── vite-env.d.ts            # Tipos de Vite
│   └── main.tsx                 # Bootstrap de React
├── playwright.config.ts
├── vitest.config.ts
└── vite.config.ts
```

Los tests unitarios están colocados junto al código, dentro de carpetas `__tests__/`.

## Testing

### Unitarios (Vitest)

- Entorno `jsdom`, `globals: true` y setup en `src/test-setup.ts`.
- Cobertura con provider `v8` sobre `src/**/*.ts` y `src/**/*.tsx`.
- Cubren componentes, hooks, base de datos y utilidades.

```bash
pnpm test              # modo watch
pnpm exec vitest run   # una corrida
pnpm coverage          # corrida con cobertura
```

### End-to-end (Playwright)

- Configurados en `e2e/`, sobre una instancia de Vite (`pnpm dev --host 127.0.0.1`, puerto 5173).
- Dos dispositivos emulados: `iphone-se` (375x667) e `iphone-14` (390x844), ambos mobile con touch.

```bash
pnpm exec playwright test
```

### CI

El workflow `.github/workflows/ci.yml` corre en `push` y `pull_request` sobre `master`, con pnpm 11.2.2 y Node 22. Tiene dos jobs:

- **verify** — `pnpm lint`, `pnpm exec tsc -b` y `pnpm exec vitest run`.
- **e2e** — instala Chromium y ejecuta `pnpm exec playwright test`.

## Notas

- **Sin backend**: los datos persisten únicamente en IndexedDB dentro del navegador del usuario (Dexie). No hay servidor ni sincronización entre dispositivos.
- **Offline**: el service worker cachea los assets de la app (y las fuentes de Google). La app funciona sin conexión una vez cargada.
- **Respaldo**: como los datos son locales, la exportación JSON es la única forma de conservarlos al limpiar el navegador o cambiar de dispositivo.
- **Base inicial**: al primer arranque, si la base está vacía, se cargan 44 productos (12 Frutos Secos, 13 Semillas/Cereal, 11 Fruta Deshidratada, 8 Legumbres).
- **Cálculo de precios**: `precio bruto = redondeo(precio neto × 1.19)`; el total de una línea es `formato (kg) × precio bruto`. Los formatos usan coma decimal chilena (por ejemplo, `11,34`).
- **Bundle del PDF**: el módulo de `@react-pdf/renderer` se carga con import dinámico en un chunk separado (`react-pdf`), fuera del bundle inicial.
