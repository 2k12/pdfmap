import { expect, test } from '@playwright/test';
import { uploadSample } from './helpers';

test.describe('Carga de archivos', () => {
  test('[RF-01][RF-02][RF-04] sube un PDF por fragmentos y queda listo para mapear', async ({
    page,
  }) => {
    const row = await uploadSample(page);
    await expect(row.getByRole('link', { name: 'Mapear' })).toBeVisible();
    await expect(row).not.toContainText('—'); // páginas y líneas conocidas
  });

  test('[RF-03] rechaza un tipo de archivo no soportado', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles({
      name: 'imagen.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e47', 'hex'),
    });
    await expect(page.getByRole('alert')).toContainText('no soportado');
  });

  test('[RF-18] elimina un archivo', async ({ page }) => {
    const name = `borrar-${Date.now()}.pdf`;
    const row = await uploadSample(page, name);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /Eliminar/ }).click();
    await expect(page.getByTestId('file-row').filter({ hasText: name })).toHaveCount(0);
  });
});
