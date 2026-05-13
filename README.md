# Produclist — Lista de Precios PWA

React + Vite PWA para gestionar una lista editable de productos con exportación a PDF. Mobile-first, foco en Android.

## Características

- **Lista editable de productos** — agregar, editar, eliminar productos con doble-click o modal
- **Agrupación por categoría** — Frutos Secos, Semillas/Cereal, Fruta Deshidratada, Legumbres
- **Exportación a PDF** — generación de lista de precios en formato landscape A4
- **Cálculo automático** — precio bruto = precio neto × 1.19
- **100% offline** — datos en IndexedDB (Dexie.js), service worker para assets
- **Instalable como app** — PWA con install prompt para Android Chrome

## Tech Stack

| Dependencia | Uso |
|-------------|-----|
| React 18 + Vite | Framework y build |
| TypeScript | Tipado estático |
| TailwindCSS v4 | Estilos |
| Dexie.js | Base de datos local (IndexedDB) |
| @react-pdf/renderer | Generación de PDF |
| vite-plugin-pwa | Service worker y manifest |

## Scripts

```bash
pnpm install         # Instalar dependencias
pnpm dev             # Desarrollo (http://localhost:5173)
pnpm build           # Build de producción
pnpm test            # Tests con Vitest
pnpm preview         # Preview del build
```

## Estructura del proyecto

```
src/
├── components/       # Componentes React
│   ├── ProductList.tsx    # Lista principal agrupada por categoría
│   ├── ProductRow.tsx     # Fila editable de producto
│   ├── ProductForm.tsx    # Modal para agregar/editar
│   ├── CategoryGroup.tsx  # Sección colapsable por categoría
│   ├── PDFButton.tsx      # Botón flotante de exportación PDF
│   └── InstallPrompt.tsx  # Banner de instalación PWA
├── db/
│   ├── database.ts   # Schema de Dexie (products table)
│   └── seed.ts       # Datos iniciales (~47 productos)
├── hooks/            # useProducts, useAddProduct, etc.
├── pdf/
│   └── ProductPDFDocument.tsx  # Template del PDF
├── types/
│   └── product.ts    # Product, ProductInput, Category
└── utils/
    └── price.ts      # calcPrecioBruto
```

## Layout del PDF

```
┌─────────────────────────────────────────────────────────┐
│ Lista de Precios          12/05/2026    Andes Granel    │
├─────────────────────────────────────────────────────────┤
│ PRODUCTO    │ FORMATO │ PRECIO NETO │ PRECIO BRUTO │ DISP │
├─────────────┼─────────┼─────────────┼──────────────┼─────┤
│ FRUTOS SECOS (categoría)                                    │
│ Almendra...  │ 1 kg    │ $ 8.500     │ $ 10.115     │ Sí  │
│ Pecán...     │ 500 g   │ $ 6.200     │ $ 7.378      │ Sí  │
├─────────────┼─────────┼─────────────┼──────────────┼─────┤
│ LEGUMBRES (categoría)                                       │
│ ...                                                         │
└─────────────────────────────────────────────────────────┘
```

## Desarrollo

```bash
# Clonar y correr
git clone https://github.com/Piwen99/produclist-pwa.git
cd produclist-pwa
pnpm install
pnpm dev
```

El servidor de desarrollo soporta HMR y regenera el PDF automáticamente cuando hay cambios.

## Notas

- **Foco mobile**: diseñado para 360px de ancho mínimo
- **Bundle splitting**: el módulo de PDF (~1.4MB) se carga lazily solo cuando el usuario clickea "Generar PDF"
- **Sin backend**: todos los datos persisten en el navegador del usuario
- **47 productos precargados**: semilla incluye productos de prueba (frutos secos, semillas, fruta deshidratada, legumbres)