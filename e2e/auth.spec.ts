import { test, expect } from '@playwright/test';

test.describe('Auth gate', () => {
  test('is authenticated by default under VITE_E2E', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Menú de opciones' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0);
  });

  test('gates with login, signs in, then signs out', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('e2e:auth', 'off');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Correo electrónico')).toBeVisible();

    await page.getByLabel('Correo electrónico').fill('vendedor@example.com');
    await page.getByLabel('Contraseña').fill('secret');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByRole('button', { name: 'Menú de opciones' })).toBeVisible();

    await page.getByRole('button', { name: 'Menú de opciones' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page.getByLabel('Contraseña')).toBeVisible();
  });
});
