import { describe, it, expect, beforeEach } from 'vitest';
import { seedProducts } from '../seed';
import { db } from '../database';
import type { Category } from '../../types/product';

describe('seedProducts', () => {
  it('should have at least 40 products', () => {
    expect(seedProducts.length).toBeGreaterThanOrEqual(40);
  });

  it('should have products in all 4 categories', () => {
    const categories = new Set(seedProducts.map(p => p.categoria));
    expect(categories.size).toBe(4);
    
    const expectedCategories: Category[] = ['Frutos Secos', 'Semillas/Cereal', 'Fruta Deshidratada', 'Legumbres'];
    expectedCategories.forEach(cat => {
      expect(categories.has(cat)).toBe(true);
    });
  });

  it('should have valid product data', () => {
    seedProducts.forEach(product => {
      expect(product.nombre).toBeTruthy();
      expect(product.categoria).toBeTruthy();
      expect(product.formato).toBeTruthy();
      expect(product.precioNeto).toBeGreaterThan(0);
      expect(product.disponible).toBe(true);
    });
  });
});

describe('database CRUD', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.products.clear();
  });

  it('should add a product', async () => {
    const id = await db.products.add({
      nombre: 'TEST PRODUCT',
      categoria: 'Frutos Secos',
      formato: '10',
      precioNeto: 1000,
      disponible: true
    });
    
    expect(id).toBeGreaterThan(0);
    
    const product = await db.products.get(id);
    expect(product).toBeDefined();
    expect(product?.nombre).toBe('TEST PRODUCT');
  });

  it('should update a product', async () => {
    const id = await db.products.add({
      nombre: 'TEST PRODUCT',
      categoria: 'Frutos Secos',
      formato: '10',
      precioNeto: 1000,
      disponible: true
    });
    
    await db.products.update(id, { precioNeto: 2000 });
    
    const product = await db.products.get(id);
    expect(product?.precioNeto).toBe(2000);
  });

  it('should delete a product', async () => {
    const id = await db.products.add({
      nombre: 'TEST PRODUCT',
      categoria: 'Frutos Secos',
      formato: '10',
      precioNeto: 1000,
      disponible: true
    });
    
    await db.products.delete(id);
    
    const product = await db.products.get(id);
    expect(product).toBeUndefined();
  });

  it('should query products by category', async () => {
    await db.products.bulkAdd([
      { nombre: 'ALMENDRA', categoria: 'Frutos Secos', formato: '10', precioNeto: 1000, disponible: true },
      { nombre: 'AVENA', categoria: 'Semillas/Cereal', formato: '25', precioNeto: 500, disponible: true },
      { nombre: 'MANI', categoria: 'Frutos Secos', formato: '25', precioNeto: 800, disponible: true }
    ]);
    
    const frutosSecos = await db.products.where('categoria').equals('Frutos Secos').toArray();
    expect(frutosSecos.length).toBe(2);
    
    const semillas = await db.products.where('categoria').equals('Semillas/Cereal').toArray();
    expect(semillas.length).toBe(1);
  });
});
