import { expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE_PDF = path.resolve(here, '../../backend/tests/fixtures/sample_report.pdf');
export const API = process.env.E2E_API_URL ?? '/api/v1';

/** Sube el PDF sintético desde la UI y espera a que termine la extracción.
 *  `name` permite un nombre único para localizar la fila sin ambigüedad. */
export async function uploadSample(page: Page, name = 'sample_report.pdf') {
  await page.goto('/');
  await page
    .getByTestId('file-input')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer: fs.readFileSync(SAMPLE_PDF) });
  await expect(page.getByTestId('upload-progress')).toContainText(name);
  const row = page.getByTestId('file-row').filter({ hasText: name }).first();
  await expect(row).toContainText('Listo', { timeout: 60_000 });
  return row;
}

/** Plantilla robusta (basada en grupos regex) para el reporte de ventas sintético. */
export const SALES_TEMPLATE = {
  name: `E2E ventas ${Date.now()}`,
  description: 'Creada por las pruebas e2e',
  rules: [
    {
      id: 'vendedor',
      name: 'Vendedor',
      action: 'context',
      match: {
        type: 'regex',
        value: '^Vendedor:\\s+(?P<codigo>\\S+)\\s+(?P<nombre>.+?)\\s+Zona:\\s*(?P<zona>.*)$',
      },
      fields: [
        { key: 'codigo', group: 'codigo', type: 'text' },
        { key: 'nombre', group: 'nombre', type: 'text' },
        { key: 'zona', group: 'zona', type: 'text' },
      ],
    },
    {
      id: 'venta',
      name: 'Venta',
      action: 'row',
      match: {
        type: 'regex',
        value:
          '^(?P<fecha>\\d{2}/\\d{2}/\\d{4})\\s+(?P<doc>\\S+)\\s+(?P<cliente>.+?)\\s+(?P<cant>\\d+)\\s+(?P<total>[\\d,.]+)\\s*$',
      },
      fields: [
        { key: 'fecha', group: 'fecha', type: 'date', date_formats: ['%d/%m/%Y'] },
        { key: 'doc', group: 'doc', type: 'text' },
        { key: 'cliente', group: 'cliente', type: 'text' },
        { key: 'cant', group: 'cant', type: 'integer' },
        { key: 'total', group: 'total', type: 'number' },
      ],
    },
  ],
  columns: [
    { id: 'vendedor', header: 'Vendedor', sources: ['vendedor.nombre'] },
    { id: 'fecha', header: 'Fecha', sources: ['venta.fecha'] },
    { id: 'documento', header: 'Documento', sources: ['venta.doc'] },
    { id: 'cliente', header: 'Cliente', sources: ['venta.cliente'] },
    { id: 'total', header: 'Total', sources: ['venta.total'], total: true },
  ],
  options: { sheet_name: 'Ventas' },
};

export async function createTemplate(request: APIRequestContext) {
  const res = await request.post(`${API}/templates`, { data: SALES_TEMPLATE });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; name: string };
}

/** Arrastre con el ratón (dnd-kit necesita movimientos intermedios). */
export async function dragTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  // dnd-kit descarta el primer clic justo después de soltar (evita clics accidentales):
  // esperar a que libere ese bloqueo antes de la siguiente interacción.
  await page.waitForTimeout(150);
}

export async function center(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Elemento no visible: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
