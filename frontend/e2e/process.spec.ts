import { expect, test } from '@playwright/test';
import { createTemplate, uploadSample } from './helpers';

test.describe('Procesamiento y descarga', () => {
  test('[RF-13][RF-14][RF-15][RF-17] procesa con una plantilla guardada y descarga XLSX y CSV', async ({
    page,
    request,
  }) => {
    const template = await createTemplate(request);
    const row = await uploadSample(page);
    const href = await row.getByRole('link', { name: 'Mapear' }).getAttribute('href');
    await page.goto(`${href}?template=${template.id}`);
    await expect(page.getByTestId('rule-item-venta')).toBeVisible();

    await page.getByRole('tab', { name: '3. Procesar' }).click();
    await page.getByLabel('CSV').check();
    await page.getByRole('button', { name: 'Procesar archivo completo' }).click();
    await expect(page.getByTestId('job-progress')).toBeVisible();
    await expect(page.getByTestId('download-xlsx')).toBeVisible({ timeout: 60_000 });

    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-xlsx').click(),
    ]);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-csv').click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/\.csv$/);

    await expect(page.getByTestId('results-table')).toContainText('COMERCIAL ANDES');
  });

  test('[RF-13] guarda la plantilla editada en el mapeador', async ({ page }) => {
    const row = await uploadSample(page);
    await row.getByRole('link', { name: 'Mapear' }).click();
    await page.getByLabel('Nombre de la plantilla').fill(`E2E guardada ${Date.now()}`);
    await page.getByRole('button', { name: /Guardar plantilla/ }).click();
    await expect(page.getByText('Plantilla guardada.')).toBeVisible();
    await expect(page).toHaveURL(/template=/);
  });
});
