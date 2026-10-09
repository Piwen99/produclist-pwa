# Produclist — Lista de Precios PWA

PWA para gestionar una lista editable de precios de productos alimenticios, armar cotizaciones y registrar el último precio enviado a cada cliente. Ahora es **server-first sobre Supabase** (Postgres + Auth + RLS): cada fila pertenece a su dueño y el admin tiene una vista global aditiva de solo lectura. El modo offline ya **no** está soportado (trade-off aceptado).

## Puesta en marcha

Requisitos: Node 22, pnpm 11.2.2 y la Supabase CLI para tareas de base de datos.

1. `pnpm install`
2. Crear `.env.local` (ignorado por git vía `*.local`) con las variables de entorno de la sección siguiente.
3. `pnpm dev`

Sin configuración, la app muestra la pantalla en español "Aplicación no configurada".

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anon/publishable (pensada para ser pública). La `service-role` nunca se usa ni se commitea. |
| `VITE_E2E` | Solo tests: `1` selecciona el auth stub y los repos falsos. **Ignorada en builds de producción.** |

Valores de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: Supabase → Project Settings → API.

## Modelo de datos y seguridad

Tablas: `productos`, `cotizaciones`, `listas_enviadas`, `perfiles`.

- Toda fila de datos lleva `owner_id uuid not null default auth.uid()`.
- Unicidad por usuario: `productos(owner_id, nombre)` (dos vendedores pueden tener el mismo nombre de producto).
- Las filas usan IDs numéricos `bigint identity`.
- `perfiles.rol` es `'admin' | 'vendedor'`.

La seguridad se aplica en un único punto: **RLS**.

- Lectura: `owner_id = auth.uid() OR is_admin(auth.uid())`.
- Escritura: requiere `owner_id = auth.uid()`.
- `is_admin()` es un helper no recursivo `SECURITY DEFINER` (evita el error 42P17 de recursión en la policy de `perfiles`).

El admin ve las filas de todos los dueños en modo lectura, pero solo puede editar las propias.

## Base de datos y migraciones

| Entorno | Comandos |
|---------|----------|
| Local | `supabase start` y luego `supabase db reset` (aplica `supabase/migrations/20261005000000_init.sql`). |
| Remoto / linkeado | `supabase link --project-ref <project-ref>` y luego `supabase db push`. |

No hay seed SQL (`[db.seed] enabled=false`): los 44 productos base se siembran por usuario en runtime desde la app.

## Autenticación y alta de cuentas

- Login por email/password.
- Autoregistro deshabilitado (`enable_signup=false` en `[auth]` y `[auth.email]`).
- Las cuentas se crean desde el dashboard de Supabase: Authentication → Users → Add user (email + password). El trigger `on_auth_user_created` crea la fila de `public.perfiles` correspondiente con `rol = 'vendedor'`.
- Promover al admin (idempotente):

  ```sql
  update public.perfiles set rol = 'admin' where email = '<admin-email>';
  ```

## Respaldo e importación

- La exportación JSON v3 incluye `products` + `quotes` + `listSends` (`produclist-backup-YYYY-MM-DD.json`).
- Los archivos v1 (arreglo simple de productos) y v2 (sin listas enviadas) todavía se pueden importar.
- La importación es vista previa + confirmación explícita, lee la partición propia del usuario y es idempotente: reimportar es un no-op.
- Los borradores (`localStorage`) son autoguardado efímero y quedan deliberadamente fuera de los respaldos.

## Funcionalidades

### Productos
- **Lista editable** — agregar, editar y eliminar; el precio bruto se calcula automáticamente.
- **Disponibilidad por producto.**
- **Búsqueda y filtro** — por nombre y por "Solo disponibles".
- **Agrupación por categoría** — secciones colapsables con conteo.

### Cotizador
- **Armado de cotización** — productos, cantidad y precio por kg editables.
- **Totales en vivo** — kg, subtotal neto, IVA 19% y total.
- **Cliente opcional** — con autocompletado.
- **Borrador autoguardado** — sobrevive a un refresh.
- **Compartir** — portapapeles, WhatsApp y Web Share API.

### Historial y clientes
- **Historial de cotizaciones.**
- **Listas enviadas** — snapshot congelado de los precios informados a un cliente.
- **Último precio por cliente** — consolidando listas enviadas y cotizaciones.

### Exportación e instalación
- **PDF de lista de precios** — `@react-pdf/renderer`, A4 horizontal, agrupado por categoría e incluyendo solo los disponibles.
- **PWA instalable** — manifest y service worker (`vite-plugin-pwa`).

### Interfaz
- Notificaciones tipo toast (éxito, error, info, advertencia).
- `ErrorBoundary` con pantalla de recuperación.
- Estilos adaptables al modo oscuro según la preferencia del sistema.

### Base inicial
44 productos sembrados por usuario: 12 Frutos Secos, 13 Semillas/Cereal, 11 Fruta Deshidratada y 8 Legumbres.

## Menú

Pantalla de login y acción "Cerrar sesión".

## Scripts

| Comando | Acción |
|---------|--------|
| `pnpm dev` | Servidor de desarrollo de Vite. |
| `pnpm build` | `tsc -b` + `vite build`. |
| `pnpm lint` | ESLint sobre el proyecto. |
| `pnpm preview` | Sirve el build de producción. |
| `pnpm coverage` | Corrida única de Vitest con cobertura; **el único comando unitario usado en CI**. |

> `pnpm test` es modo **watch** (queda escuchando). Para una corrida única se usa `pnpm coverage`.

## Estructura del proyecto

```
produclist/
├── .github/workflows/ci.yml     # CI: lint, typecheck, coverage y e2e (sin secretos)
├── e2e/                         # Tests end-to-end (Playwright)
│   ├── auth.spec.ts
│   ├── diagnose.spec.ts
│   └── responsive.spec.ts
├── public/                      # Íconos PWA
├── src/
│   ├── auth/                    # Sesión y login
│   │   ├── AuthProvider.tsx     # Provider de sesión
│   │   ├── useAuth.ts
│   │   ├── LoginScreen.tsx
│   │   ├── ports.ts             # Contrato AuthPort
│   │   ├── supabaseAuth.ts      # Adaptador Supabase
│   │   └── testing/             # fakeAuth para e2e
│   ├── data/                    # Puertos y adaptadores de datos
│   │   ├── ports.ts             # Contratos (Repositories)
│   │   ├── DataProvider.tsx
│   │   ├── useData.ts
│   │   ├── ProductsCache.ts
│   │   ├── seedProducts.ts      # 44 productos base
│   │   ├── supabase/            # client, rows, mappers, *Repo, repositories
│   │   ├── local/draftsRepo.ts  # Borradores en localStorage
│   │   └── testing/             # inMemoryRepos y stub para e2e
│   ├── components/              # Componentes de UI
│   ├── hooks/                   # useProducts, useQuote, useToast, etc.
│   ├── pdf/                     # Documentos PDF (productos y cotización)
│   ├── types/                   # product, quote, listSend, profile
│   ├── utils/                   # price, exportImport, listSend, clientTracking, clientNames
│   ├── Root.tsx                 # Auth gate + pantalla de config-error
│   ├── App.tsx                  # Rutas y composición
│   ├── main.tsx                 # Bootstrap de React
│   ├── test-setup.ts            # Setup de Vitest
│   ├── index.css / App.css
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml
│   └── migrations/20261005000000_init.sql
├── playwright.config.ts
├── vitest.config.ts
└── vite.config.ts
```

## Testing

### Unitarios (Vitest)

- Entorno `jsdom` con `globals: true` y setup en `src/test-setup.ts`.
- Cobertura sobre `src/**` con umbrales 60/55/60/60 (statements/branches/functions/lines).
- `src/data/testing/**` está excluido de la cobertura.

```bash
pnpm coverage
```

### End-to-end (Playwright)

- Tests en `e2e/` (`auth`, `diagnose`, `responsive`) contra un servidor de desarrollo de Vite.
- El `webServer` de `playwright.config.ts` exporta `VITE_E2E=1`, así que los e2e usan el stub.
- Dos perfiles móviles: `iphone-se` (375x667) e `iphone-14` (390x844).

```bash
pnpm exec playwright test
```

## CI

`.github/workflows/ci.yml` corre en `push` y `pull_request` sobre `master`, **sin credenciales** (ningún secreto de Supabase). Tiene dos jobs:

- **verify** — `pnpm lint`, `pnpm exec tsc -b` y `pnpm coverage`.
- **e2e** — instala Chromium y ejecuta `pnpm exec playwright test`.

## Cutover y migración por dispositivo

1. **Antes** — cada usuario exporta un backup v3 en su propio dispositivo y congela la carga de datos.
2. **Cutover** — se mergea el tracker a `master` y se despliega (Vercel auto-despliega `master`).
3. **Después** — cada usuario inicia sesión en su dispositivo, obtiene el seed de 44 productos por usuario e importa su propio archivo v3. La importación es aditiva y por dueño, así que reimportar es un no-op y no hace falta ninguna corrida canónica/central.
4. **Rollback** — redeployar el build anterior (era Dexie) y reimportar el último archivo v3. Las escrituras en Supabase posteriores al cutover no se recuperan.
5. **Gate Free → Pro** — los proyectos Supabase Free se pausan y son solo para desarrollo; hay que pasar a Pro (owner: Piwen) antes de que vendedores reales dependan de la app. Hasta entonces, el export/import manual v3 es la vía de recuperación.

## Tech Stack

| Dependencia | Uso |
|-------------|-----|
| React + React DOM 19 | UI |
| Vite + TypeScript | Build y servidor de desarrollo |
| TailwindCSS | Estilos |
| React Router | Ruteo de vistas |
| @supabase/supabase-js | Postgres + Auth + RLS |
| @react-pdf/renderer | Generación del PDF |
| vite-plugin-pwa | Service worker y manifest |
| Vitest + Testing Library | Tests unitarios |
| Playwright | Tests end-to-end |
