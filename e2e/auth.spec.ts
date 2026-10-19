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

  test('opens the change-password dialog from the options menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Menú de opciones' }).click();
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Contraseña actual').fill('current-secret');
    await dialog.getByLabel('Nueva contraseña', { exact: true }).fill('new-secret-1');
    await dialog.getByLabel('Repetir nueva contraseña', { exact: true }).fill('new-secret-1');
    await dialog.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(dialog).toHaveCount(0);
  });
});
