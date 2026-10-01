import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { DesignerPanel } from '../../src/features/designer/DesignerPanel';
import { cleanTemplate } from '../../src/lib/template';
import { useTemplateStore } from '../../src/store/templateStore';
import { SALES_TEMPLATE } from '../fixtures/data';
import { server } from '../mocks/server';
import { renderWithProviders } from '../utils';

const store = () => useTemplateStore.getState();

describe('DesignerPanel – diseño visual del Excel', () => {
  it('[RF-11] muestra la paleta de fuentes agrupada por regla y las columnas en orden', async () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    expect(screen.getByTestId('source-chip-venta.total')).toHaveTextContent('Total');
    expect(screen.getByTestId('source-chip-@page')).toBeInTheDocument();
    expect(screen.queryByTestId('source-chip-total_vendedor.total')).not.toBeInTheDocument();
    const strip = screen.getByTestId('columns-strip');
    const headers = within(strip)
      .getAllByRole('button', { pressed: false })
      .map((b) => b.querySelector('strong')?.textContent);
    expect(headers).toEqual(['Vendedor', 'Fecha', 'Cliente', 'Total', 'Página']);
  });

  it('[RF-11] el botón + de una fuente crea una columna (alternativa accesible al arrastre)', async () => {
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    await user.click(screen.getByRole('button', { name: 'Agregar columna Documento' }));
    expect(store().template.columns.at(-1)).toMatchObject({
      header: 'Documento',
      sources: ['venta.documento'],
    });
    expect(screen.getByTestId('column-documento')).toBeInTheDocument();
    // Queda seleccionada y se puede editar.
    expect(screen.getByRole('form', { name: 'Editar columna Documento' })).toBeInTheDocument();
  });

  it('[RF-11] edita encabezado, ancho, formato, totales y fuentes de una columna', async () => {
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    await user.click(
      within(screen.getByTestId('column-total')).getByRole('button', { name: /^Total/ }),
    );
    const form = screen.getByRole('form', { name: 'Editar columna Total' });
    await user.clear(within(form).getByLabelText('Encabezado'));
    await user.type(within(form).getByLabelText('Encabezado'), 'Importe');
    await user.type(within(form).getByLabelText('Ancho'), '14');
    await user.type(within(form).getByLabelText('Formato Excel'), '0.00');
    await user.click(within(form).getByLabelText('Sumar en la fila de totales'));
    await user.selectOptions(within(form).getByLabelText('Agregar fuente'), '@page');
    const col = () => store().template.columns.find((c) => c.id === 'total')!;
    expect(col()).toMatchObject({
      header: 'Importe',
      width: 14,
      number_format: '0.00',
      total: false,
    });
    expect(col().sources).toEqual(['venta.total', '@page']);
    const editForm = screen.getByRole('form', { name: 'Editar columna Importe' });
    await user.click(within(editForm).getAllByRole('button', { name: 'Subir fuente' })[1]);
    expect(col().sources).toEqual(['@page', 'venta.total']);
    await user.click(within(editForm).getAllByRole('button', { name: 'Bajar fuente' })[0]);
    await user.click(within(editForm).getByRole('button', { name: 'Quitar fuente @page' }));
    expect(col().sources).toEqual(['venta.total']);
    await user.click(within(editForm).getByLabelText('Incluir en el Excel'));
    expect(col().enabled).toBe(false);
    await user.click(within(editForm).getByRole('button', { name: 'Eliminar columna' }));
    expect(store().template.columns.find((c) => c.id === 'total')).toBeUndefined();
  });

  it('[RF-11] configura las opciones del libro', async () => {
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    const form = screen.getByRole('form', { name: 'Opciones del Excel' });
    await user.clear(within(form).getByLabelText('Nombre de la hoja'));
    await user.type(within(form).getByLabelText('Nombre de la hoja'), 'Resumen');
    await user.click(within(form).getByLabelText('Autofiltro'));
    await user.click(within(form).getByLabelText('Fila de totales'));
    await user.selectOptions(within(form).getByLabelText('Separador CSV'), ',');
    expect(store().template.options).toMatchObject({
      sheet_name: 'Resumen',
      autofilter: false,
      totals_row: false,
      csv_delimiter: ',',
    });
  });

  it('[RF-12][RF-16] muestra la vista previa en vivo con estadísticas de cuadre', async () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    const table = await screen.findByTestId('preview-table', {}, { timeout: 3000 });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['#', 'Vendedor', 'Fecha', 'Cliente', 'Total', 'Página']);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Cuadres OK').nextSibling).toHaveTextContent('2');
    expect(screen.getByText(/venta: 3/)).toBeInTheDocument();
    // Al cambiar la plantilla la vista previa se recalcula.
    store().updateColumn('cliente', { header: 'Razón social' });
    await waitFor(
      () =>
        expect(
          within(screen.getByTestId('preview-table')).getByText('Razón social'),
        ).toBeInTheDocument(),
      {
        timeout: 3000,
      },
    );
  });

  it('[RF-16] lista errores de conversión y descuadres de la vista previa', async () => {
    server.use(
      http.post('*/api/v1/mapping/preview', () =>
        HttpResponse.json({
          columns: [{ id: 'a', header: 'A', type: 'text' }],
          rows: [],
          stats: {
            lines: 10,
            rows: 0,
            unmatched: 10,
            rule_hits: {},
            error_count: 1,
            errors: [{ page: 1, line: 4, rule: 'venta', message: "total: 'abc' no es un número" }],
            checks_ok: 0,
            checks_failed_count: 1,
            checks_failed: [
              {
                page: 1,
                line: 6,
                rule: 'total_vendedor',
                message: 'total: impreso 10 vs calculado 9',
              },
            ],
          },
        }),
      ),
    );
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    expect(
      await screen.findByText(/impreso 10 vs calculado 9/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no es un número/)).toBeInTheDocument();
    expect(screen.getByText('Sin filas.')).toBeInTheDocument();
  });

  it('[RF-12] sin reglas o columnas no pide vista previa', () => {
    renderWithProviders(<DesignerPanel fileId="file-1" />);
    expect(screen.getByText(/Agrega al menos una regla y una columna/)).toBeInTheDocument();
    expect(screen.getByText(/Crea reglas con campos/)).toBeInTheDocument();
    expect(screen.getByText('Suelta aquí una fuente')).toBeInTheDocument();
  });
});
