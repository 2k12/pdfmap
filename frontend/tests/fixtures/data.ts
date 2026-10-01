import type { FileOut, Template } from '../../src/api/types';

/** Página sintética de un "REPORTE DE VENTAS POR VENDEDOR" (mismo formato que el PDF de e2e). */
export const SAMPLE_LINES = [
  'REPORTE DE VENTAS POR VENDEDOR                              Pag. 1',
  'Fecha       Documento  Cliente                       Cant      Total',
  'Vendedor: V001 ANA PEREZ          Zona: NORTE',
  '01/02/2026  F-000123   COMERCIAL ANDES S.A.          10   1,250.50',
  '03/02/2026  F-000124   DISTRIBUIDORA SUR              5     320.00',
  'Total vendedor:                                           1,570.50',
  'Vendedor: V002 LUIS TORRES        Zona: SUR',
  '05/02/2026  F-000125   FERRETERIA EL PERNO            2      80.25',
  'Total vendedor:                                              80.25',
];

export const READY_FILE: FileOut = {
  id: 'file-1',
  name: 'ventas.pdf',
  size: 123_456,
  kind: 'pdf',
  status: 'ready',
  progress: 1,
  pages: 3,
  lines: 27,
  error: null,
  created_at: '2026-10-01T10:00:00Z',
  extraction: { char_width: 4.2, x_origin: 20, y_tolerance: 2 },
};

/** Plantilla de ventas equivalente a la del PDF sintético. */
export const SALES_TEMPLATE: Template = {
  id: 'tpl-sales',
  name: 'Ventas por vendedor',
  description: 'Plantilla de prueba',
  version: 1,
  rules: [
    {
      id: 'vendedor',
      name: 'Vendedor',
      color: '#2563eb',
      action: 'context',
      match: {
        type: 'regex',
        value: '^Vendedor:\\s+(?P<codigo>\\S+)\\s+(?P<nombre>.*?)\\s+Zona:\\s*(?P<zona>.*)$',
      },
      fields: [
        { key: 'codigo', label: 'Código', group: 'codigo', type: 'text' },
        { key: 'nombre', label: 'Nombre', group: 'nombre', type: 'text' },
        { key: 'zona', label: 'Zona', group: 'zona', type: 'text' },
      ],
    },
    {
      id: 'venta',
      name: 'Venta',
      color: '#16a34a',
      action: 'row',
      match: { type: 'regex', value: '^\\d{2}/\\d{2}/\\d{4}' },
      fields: [
        {
          key: 'fecha',
          label: 'Fecha',
          start: 0,
          end: 10,
          type: 'date',
          date_formats: ['%d/%m/%Y'],
        },
        { key: 'documento', label: 'Documento', start: 12, end: 21, type: 'text' },
        { key: 'cliente', label: 'Cliente', start: 23, end: 52, type: 'text' },
        { key: 'cantidad', label: 'Cant', start: 52, end: 56, type: 'integer' },
        { key: 'total', label: 'Total', start: 56, end: null, type: 'number' },
      ],
    },
    {
      id: 'total_vendedor',
      name: 'Total vendedor',
      color: '#9333ea',
      action: 'check',
      match: { type: 'regex', value: '^Total vendedor:\\s+(?P<total>\\S+)' },
      fields: [{ key: 'total', label: 'Total', group: 'total', type: 'number' }],
      check: { group: 'vendedor', compare: [{ field: 'total', sum_of: 'total' }] },
    },
  ],
  columns: [
    { id: 'vendedor', header: 'Vendedor', sources: ['vendedor.nombre'] },
    { id: 'fecha', header: 'Fecha', sources: ['venta.fecha'] },
    { id: 'cliente', header: 'Cliente', sources: ['venta.cliente'] },
    { id: 'total', header: 'Total', sources: ['venta.total'], total: true },
    { id: 'pagina', header: 'Página', sources: ['@page'] },
  ],
  options: { sheet_name: 'Ventas', totals_row: true, freeze_header: true, autofilter: true },
};

/** Versión recortada de la plantilla de ejemplo incluida (ventas por vendedor). */
export const BUILTIN_EXAMPLE: Template = {
  id: 'builtin-ventas-ejemplo',
  name: 'Ventas por vendedor (ejemplo)',
  description: 'Plantilla de ejemplo',
  builtin: true,
  version: 1,
  rules: [
    {
      id: 'encabezado',
      name: 'Encabezado de página',
      action: 'skip',
      match: { type: 'regex', value: '^(EMPRESA DEMO|REPORTE DE VENTAS|Fecha\\s+Factura|-{10,})' },
      fields: [],
    },
    {
      id: 'vendedor',
      name: 'Vendedor',
      color: '#2563eb',
      action: 'context',
      match: {
        type: 'regex',
        value: '^Vendedor: (?P<codigo>V\\d{3}) (?P<nombre>.+?)\\s+Zona: (?P<zona>\\S+)',
      },
      fields: [
        { key: 'codigo', label: 'Código', group: 'codigo', type: 'text' },
        { key: 'nombre', label: 'Nombre', group: 'nombre', type: 'text' },
        { key: 'zona', label: 'Zona', group: 'zona', type: 'text' },
      ],
    },
    {
      id: 'venta',
      name: 'Detalle de venta',
      color: '#16a34a',
      action: 'row',
      match: { type: 'regex', value: '^\\d{2}/\\d{2}/\\d{4}\\s+F-\\d{6}' },
      fields: [
        { key: 'factura', label: 'Factura', start: 12, end: 20, type: 'text' },
        { key: 'total', label: 'Total', start: 56, end: null, type: 'number' },
        { key: 'nota', label: 'Nota', constant: '', type: 'text' },
      ],
    },
    {
      id: 'nota',
      name: 'Nota (continúa la venta)',
      action: 'append',
      match: { type: 'regex', value: '^\\s+Nota: (?P<texto>.+)$' },
      fields: [{ key: 'texto', label: 'Texto', group: 'texto', type: 'text', target: 'nota' }],
    },
    {
      id: 'total_vendedor',
      name: 'Total vendedor',
      action: 'check',
      match: { type: 'regex', value: 'Total vendedor:\\s*(?P<cantidad>\\S+)\\s+(?P<total>\\S+)' },
      fields: [{ key: 'total', label: 'Total', group: 'total', type: 'number' }],
      check: { group: 'vendedor', compare: [{ field: 'total', sum_of: 'total' }] },
    },
  ],
  columns: [
    { id: 'vendedor', header: 'Vendedor', sources: ['vendedor.codigo'] },
    { id: 'factura', header: 'Factura', sources: ['venta.factura'] },
    { id: 'total', header: 'Total', sources: ['venta.total'], total: true },
    { id: 'nota', header: 'Nota', sources: ['venta.nota'] },
    { id: 'pagina', header: 'Página', sources: ['@page'] },
  ],
  options: { sheet_name: 'Ventas' },
};
