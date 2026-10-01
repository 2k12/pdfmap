import { describe, expect, it } from 'vitest';
import { resolveDrop } from '../../src/lib/dnd';
import {
  availableSources,
  blankTemplate,
  cleanTemplate,
  localTemplateErrors,
  sourceLabel,
} from '../../src/lib/template';
import { parseTemplateFile } from '../../src/lib/templateFile';
import { useTemplateStore } from '../../src/store/templateStore';
import { SALES_TEMPLATE } from '../fixtures/data';

const store = () => useTemplateStore.getState();

describe('utilidades de plantilla', () => {
  it('[RF-11] lista fuentes de campos (excepto reglas check/skip) y metadatos', () => {
    const sources = availableSources(SALES_TEMPLATE).map((s) => s.source);
    expect(sources).toContain('venta.total');
    expect(sources).toContain('vendedor.zona');
    expect(sources).not.toContain('total_vendedor.total');
    expect(sources.slice(-4)).toEqual(['@page', '@line', '@rule', '@raw']);
  });
  it('[RF-11] genera etiquetas legibles de fuentes', () => {
    expect(sourceLabel(SALES_TEMPLATE, 'venta.total')).toBe('Venta · Total');
    expect(sourceLabel(SALES_TEMPLATE, '@page')).toBe('Página');
    expect(sourceLabel(SALES_TEMPLATE, 'x.y')).toBe('x · y');
  });
  it('[RF-13] detecta errores locales antes de enviar', () => {
    expect(localTemplateErrors(SALES_TEMPLATE)).toEqual([]);
    const bad = cleanTemplate(SALES_TEMPLATE);
    bad.name = ' ';
    bad.rules.push({ ...bad.rules[0] });
    bad.rules[1].fields.push({ ...bad.rules[1].fields[0] });
    bad.columns.push({ id: 'x', header: 'X', sources: ['nope.campo'] });
    const errors = localTemplateErrors(bad);
    expect(errors).toHaveLength(4);
    expect(errors.join(' ')).toMatch(/nombre/);
    expect(errors.join(' ')).toMatch(/nope\.campo/);
  });
  it('[RF-13] la plantilla en blanco tiene opciones por defecto', () => {
    const t = blankTemplate();
    expect(t.rules).toEqual([]);
    expect(t.options.totals_row).toBe(true);
  });
});

describe('resolveDrop (arrastrar y soltar del diseñador)', () => {
  const cols = SALES_TEMPLATE.columns;
  it('[RF-11] soltar una fuente en la franja crea columna', () => {
    expect(
      resolveDrop(
        { id: 'src:venta.fecha', type: 'source', source: 'venta.fecha', label: 'Fecha' },
        'columns-strip',
        cols,
      ),
    ).toEqual({
      kind: 'add-column',
      source: 'venta.fecha',
      label: 'Fecha',
    });
  });
  it('[RF-11] soltar una fuente sobre una columna la agrega como alternativa', () => {
    expect(
      resolveDrop({ id: 'src:@page', type: 'source', source: '@page' }, 'col:cliente', cols),
    ).toEqual({
      kind: 'add-source',
      columnId: 'cliente',
      source: '@page',
    });
    expect(
      resolveDrop({ id: 'src:@page', type: 'source', source: '@page' }, 'col:nada', cols),
    ).toBeNull();
  });
  it('[RF-11] arrastrar una columna sobre otra la reordena', () => {
    expect(resolveDrop({ id: 'col:vendedor', type: 'column' }, 'col:total', cols)).toEqual({
      kind: 'move',
      from: 0,
      to: 3,
    });
    expect(resolveDrop({ id: 'col:vendedor', type: 'column' }, 'col:vendedor', cols)).toBeNull();
    expect(resolveDrop({ id: 'col:vendedor', type: 'column' }, null, cols)).toBeNull();
  });
});

describe('parseTemplateFile', () => {
  it('[RF-13] acepta JSON de plantilla', async () => {
    const t = await parseTemplateFile(
      new Blob([JSON.stringify({ name: 'x', rules: [], columns: [] })]),
    );
    expect(t.name).toBe('x');
    expect(t.options).toEqual({});
  });
  it('[RF-13] rechaza JSON inválido o sin forma de plantilla', async () => {
    await expect(parseTemplateFile(new Blob(['{no json']))).rejects.toThrow(/JSON válido/);
    await expect(parseTemplateFile(new Blob(['{"name":"x"}']))).rejects.toThrow(/rules/);
  });
});

describe('store del editor de plantillas', () => {
  it('[RF-07] crea reglas con id único y color', () => {
    const id1 = store().addRule({ name: 'Descuento' });
    const id2 = store().addRule({ name: 'Descuento' });
    expect([id1, id2]).toEqual(['descuento', 'descuento_2']);
    expect(store().template.rules[1].color).not.toBe(store().template.rules[0].color);
    expect(store().selectedRuleId).toBe('descuento_2');
    expect(store().dirty).toBe(true);
  });
  it('[RF-10] renombrar una regla actualiza columnas, clears y check.group', () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    store().updateRule('venta', { clears: [] });
    store().updateRule('vendedor', { id: 'seller' });
    const t = store().template;
    expect(t.columns[0].sources).toEqual(['seller.nombre']);
    expect(t.rules.find((r) => r.id === 'total_vendedor')!.check!.group).toBe('seller');
  });
  it('[RF-10] eliminar una regla limpia sus fuentes en columnas', () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    store().selectRule('venta');
    store().removeRule('venta');
    const t = store().template;
    expect(t.rules.map((r) => r.id)).not.toContain('venta');
    expect(t.columns.find((c) => c.id === 'total')!.sources).toEqual([]);
    expect(store().selectedRuleId).toBe('vendedor');
  });
  it('[RF-08] agrega, renombra y elimina campos', () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    const key = store().addField('venta', { label: 'Total', start: 60, end: null, type: 'number' });
    expect(key).toBe('total_2');
    store().updateField('venta', 'total', { key: 'importe' });
    expect(store().template.columns.find((c) => c.id === 'total')!.sources).toEqual([
      'venta.importe',
    ]);
    store().removeField('venta', 'importe');
    expect(store().template.columns.find((c) => c.id === 'total')!.sources).toEqual([]);
    expect(() => store().addField('nope', { type: 'text' })).toThrow();
  });
  it('[RF-11] gestiona columnas y fuentes', () => {
    store().load(cleanTemplate(SALES_TEMPLATE));
    const id = store().addColumn('venta.documento', 'Documento', 1);
    expect(store().template.columns[1].id).toBe(id);
    store().addSourceToColumn(id, '@page');
    store().addSourceToColumn(id, '@page');
    expect(store().template.columns[1].sources).toEqual(['venta.documento', '@page']);
    store().moveSource(id, 1, 0);
    expect(store().template.columns[1].sources[0]).toBe('@page');
    store().removeSourceFromColumn(id, '@page');
    store().updateColumn(id, { header: 'Doc.' });
    expect(store().template.columns[1]).toMatchObject({
      header: 'Doc.',
      sources: ['venta.documento'],
    });
    store().moveColumn(1, 0);
    expect(store().template.columns[0].id).toBe(id);
    store().moveColumn(0, 99);
    expect(store().template.columns[0].id).toBe(id);
    store().selectColumn(id);
    store().removeColumn(id);
    expect(store().selectedColumnId).toBeNull();
  });
  it('[RF-13] marca como guardada y cambia metadatos/opciones', () => {
    store().setMeta({ name: 'Otra' });
    store().setOptions({ sheet_name: 'Hoja' });
    expect(store().dirty).toBe(true);
    store().markSaved({ ...store().template, id: 'tpl-9' });
    expect(store().dirty).toBe(false);
    expect(store().template).toMatchObject({
      id: 'tpl-9',
      name: 'Otra',
      options: { sheet_name: 'Hoja' },
    });
    store().moveRule(0, 0);
  });
});
