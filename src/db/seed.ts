import { db, deduplicateProducts } from './database';
import type { ProductInput } from '../types/product';

// Dedup one-shot por sesión: corre la primera vez que se monta la app en la
// pestaña (StrictMode monta 2 veces en dev; recargas repiten el mount).
// sessionStorage persiste entre recargas de la misma pestaña; el flag de
// módulo cubre entornos sin sessionStorage (tests, SSR).
const DEDUP_KEY = 'produclist-dedup-done';
let _dedupDoneInModule = false;

async function isDedupDone(): Promise<boolean> {
  if (_dedupDoneInModule) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(DEDUP_KEY) === '1';
    }
  } catch {
    // sessionStorage puede fallar (privado/bloqueado) — flag de módulo alcanza.
  }
  return false;
}

async function markDedupDone(): Promise<void> {
  _dedupDoneInModule = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DEDUP_KEY, '1');
    }
  } catch {
    // no-op
  }
}

export const seedProducts: ProductInput[] = [
  // Frutos Secos
  { nombre: 'ALMENDRA LAMINADA', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 9200, disponible: true },
  { nombre: 'ALMENDRA ENTERA 27/30', categoria: 'Frutos Secos', formato: '22,68', precioNeto: 7800, disponible: true },
  { nombre: 'CASTAÑA DE CAJU CON SAL', categoria: 'Frutos Secos', formato: '22,68', precioNeto: 7800, disponible: true },
  { nombre: 'CASTAÑA DE CAJU SIN SAL', categoria: 'Frutos Secos', formato: '22,68', precioNeto: 7800, disponible: true },
  { nombre: 'HARINA DE ALMENDRA', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 8900, disponible: true },
  { nombre: 'MANI FRITO SIN SAL', categoria: 'Frutos Secos', formato: '25', precioNeto: 1450, disponible: true },
  { nombre: 'MANI FRITO SALADO', categoria: 'Frutos Secos', formato: '25', precioNeto: 1450, disponible: true },
  { nombre: 'NUEZ MARIPOSA CLARA', categoria: 'Frutos Secos', formato: '10', precioNeto: 8400, disponible: true },
  { nombre: 'NUEZ CUARTO CLARA', categoria: 'Frutos Secos', formato: '10', precioNeto: 8500, disponible: true },
  { nombre: 'PISTACHO SIN SAL', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 10800, disponible: true },
  { nombre: 'PISTACHO CON SAL', categoria: 'Frutos Secos', formato: '11,34', precioNeto: 10800, disponible: true },
  { nombre: 'PISTACHO PELADO', categoria: 'Frutos Secos', formato: '10', precioNeto: 25000, disponible: true },
  
  // Semillas/Cereal
  { nombre: 'AVENA INTEGRAL', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 720, disponible: true },
  { nombre: 'AVENA INSTANTANEA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 720, disponible: true },
  { nombre: 'CHIA NEGRA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 2800, disponible: true },
  { nombre: 'SESAMO TOSTADO', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 3300, disponible: true },
  { nombre: 'SESAMO NEGRO', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 3800, disponible: true },
  { nombre: 'LINAZA ENTERA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 1250, disponible: true },
  { nombre: 'SESAMO PELADO', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 2300, disponible: true },
  { nombre: 'SEMILLA DE ZAPALLO', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 4300, disponible: true },
  { nombre: 'SEMILLA DE GIRASOL', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 3500, disponible: true },
  { nombre: 'QUINOA BLANCA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 2700, disponible: true },
  { nombre: 'QUINOA ROJA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 2800, disponible: true },
  { nombre: 'QUINOA NEGRA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 2850, disponible: true },
  { nombre: 'CROCANTE DE ZAPALLO', categoria: 'Semillas/Cereal', formato: '10', precioNeto: 6600, disponible: true },
  
  // Fruta Deshidratada
  { nombre: 'BANANA CHIPS DULCE', categoria: 'Fruta Deshidratada', formato: '6,80', precioNeto: 3700, disponible: true },
  { nombre: 'BANANA CHIPS NATURAL', categoria: 'Fruta Deshidratada', formato: '6,80', precioNeto: 3600, disponible: true },
  { nombre: 'DATIL SIN CAROZO', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 2350, disponible: true },
  { nombre: 'DATIL CON CAROZO', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 2100, disponible: true },
  { nombre: 'COCO CHIPS NATURAL', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 5600, disponible: true },
  { nombre: 'COCO CHIPS DULCE', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 5800, disponible: true },
  { nombre: 'CIRUELA CALIBRE 40/50', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 4200, disponible: true },
  { nombre: 'HIGO NEGRO', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 3800, disponible: true },
  { nombre: 'DAMASCO TURCO', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 4500, disponible: true },
  { nombre: 'OREJON DE DURAZNO', categoria: 'Fruta Deshidratada', formato: '10', precioNeto: 5200, disponible: true },
  { nombre: 'MANZANA DESHIDRATADA', categoria: 'Fruta Deshidratada', formato: '5', precioNeto: 6800, disponible: true },
  
  // Legumbres
  { nombre: 'LENTEJA', categoria: 'Legumbres', formato: '25', precioNeto: 950, disponible: true },
  { nombre: 'GARBANZO', categoria: 'Legumbres', formato: '25', precioNeto: 1100, disponible: true },
  { nombre: 'GARBANZO PARTIDO PELADO', categoria: 'Legumbres', formato: '25', precioNeto: 680, disponible: true },
  { nombre: 'GARBANZO ENTERO PELADO 8MM', categoria: 'Legumbres', formato: '25', precioNeto: 1000, disponible: true },
  { nombre: 'GARBANZO ENTERO PELADO 9MM', categoria: 'Legumbres', formato: '25', precioNeto: 1200, disponible: true },
  { nombre: 'POROTO NEGRO', categoria: 'Legumbres', formato: '25', precioNeto: 1050, disponible: true },
  { nombre: 'POROTO ROJO', categoria: 'Legumbres', formato: '25', precioNeto: 980, disponible: true },
  { nombre: 'POROTO BLANCO', categoria: 'Legumbres', formato: '25', precioNeto: 920, disponible: true },
];

export async function seedDatabase(): Promise<void> {
  // Clean existing duplicates ONCE per browser session (not on every mount —
  // the dedup reads the whole table, so it was a wasted round-trip per load).
  if (!(await isDedupDone())) {
    const removed = await deduplicateProducts();
    if (removed > 0) {
      console.log(`[Seed] Removed ${String(removed)} duplicate products before seeding`);
    }
    await markDedupDone();
  }

  // Transaction ensures atomicity: if StrictMode fires twice,
  // the second call waits for the first and sees count > 0
  await db.transaction('rw', db.products, async () => {
    const count = await db.products.count();
    if (count === 0) {
      await db.products.bulkAdd(seedProducts);
      console.log(`[Seed] Added ${String(seedProducts.length)} products to database`);
    } else {
      console.log(`[Seed] Database already has ${String(count)} products, skipping seed`);
    }
  });
}
