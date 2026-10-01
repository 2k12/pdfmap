import { expect, test } from '@playwright/test';
import { center, dragTo, uploadSample } from './helpers';

test.describe('Mapeo visual', () => {
  test('[RF-07][RF-08][RF-11][RF-12] crea regla desde una línea, campo arrastrando y columna arrastrando', async ({
    page,
  }) => {
    const row = await uploadSample(page);
    await row.getByRole('link', { name: 'Mapear' }).click();

    // 1. Seleccionar una línea de detalle y crear la regla.
    const line = page.locator('[data-testid^="doc-line-"]').filter({ hasText: 'F-000123' }).first();
    await line.click();
    await page.getByRole('button', { name: 'Crear regla desde esta línea' }).click();
    await expect(page.getByTestId('rule-item-regla_1')).toBeVisible();
    await expect(line).toHaveAttribute('title', 'Regla: regla_1');

    // 2. Arrastrar sobre la fecha (columnas 0-9) para crear un campo.
    const lineId = await line.getAttribute('data-testid');
    const first = await center(page, `[data-testid="${lineId}"] [data-col="0"]`);
    const last = await center(page, `[data-testid="${lineId}"] [data-col="9"]`);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(last.x, last.y, { steps: 5 });
    await page.mouse.up();
    const dialog = page.getByTestId('new-field-dialog');
    await expect(dialog).toContainText('01/02/2026');
    await dialog.getByLabel('Etiqueta').fill('Fecha');
    await dialog.getByRole('button', { name: 'Agregar campo' }).click();
    await expect(page.getByTestId('field-band-fecha')).toBeVisible();

    // 3. Detectar el resto de columnas automáticamente.
    await page.getByRole('button', { name: 'Detectar columnas' }).click();
    await expect(page.getByText(/campos detectados/)).toBeVisible();

    // 4. Diseño Excel: arrastrar la fuente a la franja de columnas.
    await page.getByRole('tab', { name: '2. Diseño Excel' }).click();
    await dragTo(
      page,
      await center(page, '[data-testid="source-chip-regla_1.fecha"]'),
      await center(page, '[data-testid="columns-strip"]'),
    );
    await expect(page.getByTestId('column-fecha')).toBeVisible();
    await page.getByRole('button', { name: 'Agregar columna Página' }).click();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(2);

    // 5. Reordenar columnas arrastrando por el asa.
    await dragTo(
      page,
      await center(page, '[data-testid="column-pagina"] .col-card__grip'),
      await center(page, '[data-testid="column-fecha"]'),
    );
    await expect(page.locator('[data-testid^="column-"]').first()).toHaveAttribute(
      'data-testid',
      'column-pagina',
    );

    // 6. Vista previa en vivo.
    await expect(page.getByTestId('preview-table')).toContainText('Fecha', { timeout: 15_000 });
    await expect(page.getByTestId('preview-table')).toContainText('01/02/2026');
  });
});
