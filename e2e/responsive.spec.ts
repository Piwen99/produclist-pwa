import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('e2e/screenshots');

test.describe('Responsive visual tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('header must NOT overflow at 375px (iPhone SE)', async ({ page }) => {
    // This is our TDD test: no horizontal overflow in the header
    const hasOverflow = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return true; // fail if no header
      return header.scrollWidth > header.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('1. Product list screen', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `product-list-${test.info().project.name}.png`),
      fullPage: true,
    });
  });

  test('2. Cotizador screen', async ({ page }) => {
    await page.goto('/cotizador');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `cotizador-empty-${test.info().project.name}.png`),
      fullPage: true,
    });

    const addBtn = page.getByRole('button', { name: 'Agregar producto' });
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `product-selector-modal-${test.info().project.name}.png`),
        fullPage: true,
      });
    }
  });

  test('3. Quote History screen', async ({ page }) => {
    await page.goto('/historial');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `history-empty-${test.info().project.name}.png`),
      fullPage: true,
    });
  });

  test('4. Cotizador with a product added', async ({ page }) => {
    await page.goto('/cotizador');
    await page.waitForTimeout(1500);

    const addBtn = page.getByRole('button', { name: 'Agregar producto' });
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      const firstProduct = page.locator('button').filter({ has: page.locator('span.font-medium') }).first();
      if (await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstProduct.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `cotizador-with-product-${test.info().project.name}.png`),
      fullPage: true,
    });
  });
});
