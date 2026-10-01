import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MapperPage } from '../../src/features/mapper/MapperPage';
import { useTemplateStore } from '../../src/store/templateStore';
import { db } from '../mocks/handlers';
import { renderWithProviders } from '../utils';

const renderMapper = (query = '') =>
  renderWithProviders(<MapperPage />, {
    route: `/files/file-1/map${query}`,
    path: '/files/:fileId/map',
  });

const store = () => useTemplateStore.getState();

/** Simula arrastrar el ratón sobre los caracteres [from, to] de la línea n. */
function dragChars(n: number, from: number, to: number) {
  const line = screen.getByTestId(`doc-line-${n}`);
  const ch = (i: number) => line.querySelector(`[data-col="${i}"]`)!;
  fireEvent.mouseDown(ch(from), { button: 0 });
  fireEvent.mouseOver(ch(to));
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup'));
  });
}

describe('MapperPage – reglas y campos', () => {
  it('[RF-05] muestra la página con regla de columnas y navega entre páginas', async () => {
    const user = userEvent.setup();
    renderMapper();
    expect(await screen.findByTestId('doc-line-1')).toHaveTextContent('REPORTE DE VENTAS');
    expect(screen.getByTestId('ruler')).toHaveTextContent('10');
    expect(await screen.findByRole('heading', { name: 'ventas.pdf' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(screen.getByTestId('doc-line-1')).toHaveTextContent('Pag. 2'));
    const pageInput = screen.getByLabelText('Página');
    await user.clear(pageInput);
    await user.type(pageInput, '3');
    await user.click(screen.getByRole('button', { name: 'Ir' }));
    await waitFor(() => expect(screen.getByTestId('doc-line-1')).toHaveTextContent('Pag. 3'));
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    await waitFor(() => expect(screen.getByTestId('doc-line-1')).toHaveTextContent('Pag. 2'));
  });

  it('[RF-06] busca en todo el documento y salta al resultado', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-1');
    await user.type(screen.getByLabelText('Buscar en el documento'), 'LUIS');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const result = await screen.findByRole('button', { name: /p\.2 l\.7/ });
    await user.click(result);
    await waitFor(() => expect(screen.getByTestId('doc-line-1')).toHaveTextContent('Pag. 2'));
    expect(screen.getByTestId('doc-line-7')).toHaveAttribute('aria-selected', 'true');
  });

  it('[RF-07] crea una regla desde la línea seleccionada con la regex sugerida', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-4');
    const createBtn = screen.getByRole('button', { name: 'Crear regla desde esta línea' });
    expect(createBtn).toBeDisabled();
    await user.click(screen.getByTestId('doc-line-4'));
    await user.click(createBtn);
    expect(await screen.findByTestId('rule-item-regla_1')).toBeInTheDocument();
    expect(store().template.rules[0].match.value).toBe('^\\d{2}/\\d{2}/\\d{4}');
    // El formulario indica que la línea seleccionada coincide.
    expect(screen.getByText(/La línea seleccionada coincide/)).toBeInTheDocument();
    // Las líneas que coinciden quedan coloreadas tras anotar.
    await waitFor(() =>
      expect(screen.getByTestId('doc-line-4')).toHaveAttribute('title', 'Regla: regla_1'),
    );
    expect(screen.getByTestId('doc-line-3')).not.toHaveAttribute('title');
  });

  it('[RF-08] crea un campo al arrastrar sobre la línea y lo muestra como banda', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-4');
    store().addRule({ name: 'Venta', match: { type: 'regex', value: '^\\d{2}/' } });
    dragChars(4, 0, 9);
    const dialog = await screen.findByTestId('new-field-dialog');
    expect(within(dialog).getByText('01/02/2026')).toBeInTheDocument();
    // Tipo detectado automáticamente como fecha.
    expect(within(dialog).getByLabelText('Tipo')).toHaveValue('date');
    await user.type(within(dialog).getByLabelText('Etiqueta'), 'Fecha');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar campo' }));
    expect(store().template.rules[0].fields[0]).toMatchObject({
      key: 'fecha',
      start: 0,
      end: 10,
      type: 'date',
    });
    expect(screen.getByTestId('field-band-fecha')).toBeInTheDocument();
  });

  it('[RF-08] avisa si se arrastra sin regla seleccionada y permite cancelar el diálogo', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-4');
    dragChars(4, 2, 5);
    expect(await screen.findByText(/Primero crea o selecciona una regla/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    store().addRule({ name: 'Venta', match: { type: 'regex', value: '^\\d' } });
    dragChars(4, 5, 2);
    const dialog = await screen.findByTestId('new-field-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('new-field-dialog')).not.toBeInTheDocument();
    expect(store().template.rules[0].fields).toHaveLength(0);
  });

  it('[RF-08] mueve y redimensiona una banda con el teclado y el puntero', async () => {
    renderMapper();
    await screen.findByTestId('doc-line-4');
    const id = store().addRule({ name: 'Venta', match: { type: 'regex', value: '^\\d' } });
    store().addField(id, { key: 'doc', label: 'Doc', start: 12, end: 20, type: 'text' });
    const band = await screen.findByTestId('field-band-doc');
    fireEvent.keyDown(band, { key: 'ArrowRight' });
    expect(store().template.rules[0].fields[0]).toMatchObject({ start: 13, end: 21 });
    fireEvent.keyDown(band, { key: 'ArrowLeft', shiftKey: true });
    expect(store().template.rules[0].fields[0]).toMatchObject({ start: 13, end: 20 });
    fireEvent.keyDown(band, { key: 'ArrowRight', altKey: true });
    expect(store().template.rules[0].fields[0]).toMatchObject({ start: 14, end: 20 });
    fireEvent.keyDown(band, { key: 'a' });
    // Arrastre con puntero: 16px a la derecha con 8px por carácter = 2 caracteres.
    fireEvent.pointerDown(band, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(band, { clientX: 116, pointerId: 1 });
    fireEvent.pointerUp(band, { pointerId: 1 });
    expect(store().template.rules[0].fields[0]).toMatchObject({ start: 16, end: 22 });
    const handle = band.querySelector('.band__handle--end')!;
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(band, { clientX: 124, pointerId: 1 });
    fireEvent.pointerUp(band, { pointerId: 1 });
    expect(store().template.rules[0].fields[0]).toMatchObject({ start: 16, end: 25 });
  });

  it('[RF-08] detecta columnas automáticamente en las líneas de la regla', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-4');
    store().addRule({ name: 'Venta', match: { type: 'regex', value: '^\\d{2}/' } });
    await waitFor(() =>
      expect(screen.getByTestId('doc-line-4')).toHaveAttribute('title', 'Regla: venta'),
    );
    await user.click(screen.getByRole('button', { name: 'Detectar columnas' }));
    expect(await screen.findByText('3 campos detectados.')).toBeInTheDocument();
    expect(store().template.rules[0].fields.map((f) => [f.start, f.end, f.type])).toEqual([
      [0, 10, 'date'],
      [12, 20, 'text'],
      [56, null, 'number'],
    ]);
  });

  it('[RF-08] informa si ninguna línea coincide al detectar columnas', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-4');
    store().addRule({ name: 'Nada', match: { type: 'regex', value: '^ZZZ' } });
    await user.click(screen.getByRole('button', { name: 'Detectar columnas' }));
    expect(await screen.findByText(/Ninguna línea de esta página coincide/)).toBeInTheDocument();
  });

  it('[RF-09] edita tipo, formato y origen de un campo en el panel derecho', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    await user.click(
      within(screen.getByTestId('rule-item-venta')).getByRole('button', { name: /^Venta/ }),
    );
    await user.click(screen.getByRole('button', { name: /Total total/ }));
    const right = screen.getByRole('complementary', { name: 'Campos' });
    await user.selectOptions(within(right).getByLabelText('Separador decimal'), ',');
    expect(store().template.rules[1].fields[4].decimal).toBe(',');
    await user.selectOptions(within(right).getByLabelText('Tipo'), 'date');
    await user.type(within(right).getByLabelText('Formato de fecha'), '%d/%m/%Y');
    expect(store().template.rules[1].fields[4].date_formats).toEqual(['%d/%m/%Y']);
    await user.selectOptions(within(right).getByLabelText('Origen'), 'constant');
    await user.type(within(right).getByLabelText('Valor fijo'), 'X');
    expect(store().template.rules[1].fields[4].constant).toBe('X');
    await user.selectOptions(within(right).getByLabelText('Origen'), 'position');
    await user.clear(within(right).getByLabelText('Desde columna'));
    await user.type(within(right).getByLabelText('Desde columna'), '5');
    expect(store().template.rules[1].fields[4].start).toBe(5);
    await user.type(within(right).getByLabelText('Valor si está vacío'), '0');
    await user.type(within(right).getByLabelText('Tratar como vacío (separar con |)'), 'N/A');
    await user.click(within(right).getByLabelText(/Obligatorio/));
    expect(store().template.rules[1].fields[4]).toMatchObject({
      default: '0',
      null_values: ['N/A'],
      required: true,
    });
    await user.click(within(right).getByRole('button', { name: 'Eliminar campo total' }));
    expect(store().template.rules[1].fields).toHaveLength(4);
  });

  it('[RF-09] muestra los valores extraídos de la línea seleccionada', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    await waitFor(() =>
      expect(screen.getByTestId('doc-line-3')).toHaveAttribute('title', 'Regla: vendedor'),
    );
    await user.click(screen.getByTestId('doc-line-3'));
    const values = screen.getByRole('region', { name: 'Valores de la línea seleccionada' });
    expect(within(values).getByText('ANA PEREZ')).toBeInTheDocument();
    expect(within(values).getByText('NORTE')).toBeInTheDocument();
  });

  it('[RF-10] configura la acción, el patrón y el control de cuadre de una regla', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    const left = screen.getByRole('complementary', { name: 'Reglas' });
    // Patrón inválido
    const pattern = within(left).getByLabelText('Patrón');
    await user.clear(pattern);
    await user.type(pattern, '(');
    expect(within(left).getByText(/Patrón inválido/)).toBeInTheDocument();
    await user.clear(pattern);
    await user.type(pattern, '^Vendedor: (?P<extra>\\S+)');
    await user.click(within(left).getByRole('button', { name: '+ extra' }));
    expect(store().template.rules[0].fields.at(-1)).toMatchObject({ key: 'extra', group: 'extra' });
    // Acción check con comparación de suma
    await user.click(
      within(screen.getByTestId('rule-item-total_vendedor')).getByRole('button', {
        name: /^Total vendedor/,
      }),
    );
    expect(within(left).getByText('Control de cuadre', { selector: 'legend' })).toBeInTheDocument();
    await user.selectOptions(within(left).getByLabelText(/Total = suma de la columna/), 'cliente');
    expect(store().template.rules[2].check!.compare).toEqual([
      { field: 'total', sum_of: 'cliente' },
    ]);
    await user.selectOptions(within(left).getByLabelText(/Total = suma de la columna/), '');
    expect(store().template.rules[2].check!.compare).toEqual([]);
    await user.selectOptions(within(left).getByLabelText('Reiniciar sumas cuando coincide'), '');
    expect(store().template.rules[2].check!.group).toBe('');
    // Contexto: borrar otros contextos
    await user.click(
      within(screen.getByTestId('rule-item-vendedor')).getByRole('button', { name: /^Vendedor/ }),
    );
    await user.click(within(left).getByLabelText('Venta'));
    expect(store().template.rules[0].clears).toEqual(['venta']);
    await user.selectOptions(within(left).getByLabelText('Acción'), 'check');
    expect(store().template.rules[0].check).toEqual({ group: '', compare: [] });
    await user.selectOptions(within(left).getByLabelText('Tipo'), 'contains');
    await user.click(within(left).getByLabelText('Ignorar mayúsculas/minúsculas'));
    await user.click(within(left).getByLabelText('Activa'));
    expect(store().template.rules[0]).toMatchObject({
      match: { type: 'contains', ignore_case: true },
      enabled: false,
    });
    await user.clear(within(left).getByLabelText('Nombre'));
    await user.type(within(left).getByLabelText('Nombre'), 'Vend');
    const idInput = within(left).getByLabelText('Identificador');
    fireEvent.change(idInput, { target: { value: 'vend' } });
    expect(store().template.rules[0].id).toBe('vend');
  });

  it('[RF-10] reordena y elimina reglas', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    await user.click(screen.getByRole('button', { name: 'Bajar Vendedor' }));
    expect(store().template.rules.map((r) => r.id)).toEqual([
      'venta',
      'vendedor',
      'total_vendedor',
    ]);
    await user.click(screen.getByRole('button', { name: 'Subir Vendedor' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar Venta' }));
    expect(store().template.rules.map((r) => r.id)).toEqual(['vendedor', 'total_vendedor']);
    await user.click(screen.getByRole('button', { name: '+ Nueva regla' }));
    expect(store().template.rules).toHaveLength(3);
  });

  it('[RF-13] guarda una plantilla nueva y luego la actualiza', async () => {
    const user = userEvent.setup();
    renderMapper();
    await screen.findByTestId('doc-line-1');
    await user.clear(screen.getByLabelText('Nombre de la plantilla'));
    await user.type(screen.getByLabelText('Nombre de la plantilla'), 'Mi formato');
    await user.click(screen.getByRole('button', { name: /Guardar plantilla/ }));
    expect(await screen.findByText('Plantilla guardada.')).toBeInTheDocument();
    expect(db.templates.at(-1)!.name).toBe('Mi formato');
    const id = db.templates.at(-1)!.id;
    await user.type(screen.getByLabelText('Nombre de la plantilla'), ' 2');
    await user.click(screen.getByRole('button', { name: /Guardar plantilla\*/ }));
    await waitFor(() => expect(db.templates.find((t) => t.id === id)!.name).toBe('Mi formato 2'));
  });

  it('[RF-13] una plantilla de ejemplo se guarda como copia', async () => {
    const user = userEvent.setup();
    renderMapper('?template=builtin-ventas-ejemplo');
    await screen.findByTestId('rule-item-encabezado');
    await user.click(screen.getByRole('button', { name: 'Guardar como copia' }));
    await waitFor(() =>
      expect(db.templates.at(-1)!.name).toBe('Ventas por vendedor (ejemplo) (copia)'),
    );
    expect(db.templates.at(-1)!.builtin).toBe(false);
  });

  it('[RF-13] cambia de plantilla preguntando si hay cambios sin guardar', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    await screen.findByRole('option', { name: 'Ventas por vendedor' });
    store().setMeta({ name: 'cambiado' });
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.selectOptions(screen.getByLabelText('Plantilla'), '');
    expect(store().template.name).toBe('cambiado');
    await user.selectOptions(screen.getByLabelText('Plantilla'), '');
    await waitFor(() => expect(store().template.rules).toHaveLength(0));
    await user.selectOptions(screen.getByLabelText('Plantilla'), 'builtin-ventas-ejemplo');
    expect(await screen.findByTestId('rule-item-encabezado')).toBeInTheDocument();
  });

  it('[RF-11] cambia a las pestañas de diseño y procesamiento', async () => {
    const user = userEvent.setup();
    renderMapper('?template=tpl-sales');
    await screen.findByTestId('rule-item-vendedor');
    await user.click(screen.getByRole('tab', { name: '2. Diseño Excel' }));
    expect(screen.getByTestId('columns-strip')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '3. Procesar' }));
    expect(screen.getByRole('button', { name: 'Procesar archivo completo' })).toBeInTheDocument();
  });

  it('[RF-05] permite seleccionar una línea con el teclado', async () => {
    renderMapper();
    const line = await screen.findByTestId('doc-line-2');
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(line).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Línea seleccionada: p.1 l.2')).toBeInTheDocument();
  });
});
