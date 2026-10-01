import { describe, expect, it, vi } from 'vitest';
import { pendingChunks, planChunks, uploadedBytes } from '../../src/lib/chunks';
import { nextColor, RULE_PALETTE, withAlpha } from '../../src/lib/colors';
import { findOverlaps, overlapsWith, positionedFields, rangesOverlap } from '../../src/lib/columns';
import { debounce } from '../../src/lib/debounce';
import { formatBytes, formatCell, formatPercent, formatSpeed } from '../../src/lib/format';
import { guessType } from '../../src/lib/guessType';
import { matchesLocally, namedGroups, pythonToJsRegex, validateRegex } from '../../src/lib/regex';
import { rulerText } from '../../src/lib/ruler';
import {
  charIndexFromX,
  moveRange,
  normalizeRange,
  resizeRange,
  sliceLine,
} from '../../src/lib/selection';
import { ID_PATTERN, slugify, uniqueId } from '../../src/lib/slugify';

describe('slugify / uniqueId', () => {
  it('[RF-13] genera identificadores válidos desde texto libre', () => {
    expect(slugify('Débito Total')).toBe('debito_total');
    expect(slugify('  ')).toBe('campo');
    expect(slugify('123 abc')).toBe('c_123_abc');
    expect(slugify('x'.repeat(80))).toHaveLength(40);
    expect(ID_PATTERN.test(slugify('¿Qué tal? año 2026'))).toBe(true);
  });
  it('[RF-13] evita colisiones con sufijos numéricos', () => {
    expect(uniqueId('fecha', ['fecha'])).toBe('fecha_2');
    expect(uniqueId('fecha', ['fecha', 'fecha_2'])).toBe('fecha_3');
    expect(uniqueId('nuevo', [])).toBe('nuevo');
    const long = 'a'.repeat(40);
    expect(uniqueId(long, [long]).length).toBeLessThanOrEqual(40);
  });
});

describe('planificación de fragmentos', () => {
  it('[RF-02] divide el archivo en fragmentos contiguos', () => {
    const plan = planChunks(10, 4);
    expect(plan).toEqual([
      { index: 0, start: 0, end: 4 },
      { index: 1, start: 4, end: 8 },
      { index: 2, start: 8, end: 10 },
    ]);
    expect(planChunks(0, 4)).toHaveLength(1);
    expect(() => planChunks(10, 0)).toThrow();
  });
  it('[RF-02] calcula los fragmentos pendientes y los bytes ya subidos (reanudación)', () => {
    const plan = planChunks(10, 4);
    expect(pendingChunks(plan, [0, 2]).map((c) => c.index)).toEqual([1]);
    expect(uploadedBytes(plan, [0, 2])).toBe(6);
  });
});

describe('selección de rangos de caracteres', () => {
  it('[RF-08] normaliza ancla/foco en cualquier dirección', () => {
    expect(normalizeRange(5, 2)).toEqual({ start: 2, end: 6 });
    expect(normalizeRange(2, 5)).toEqual({ start: 2, end: 6 });
    expect(normalizeRange(-3, 1)).toEqual({ start: 0, end: 2 });
  });
  it('[RF-08] convierte coordenadas X a índice de carácter', () => {
    expect(charIndexFromX(17, 8)).toBe(2);
    expect(charIndexFromX(-5, 8)).toBe(0);
    expect(charIndexFromX(10, 0)).toBe(0);
  });
  it('[RF-08] mueve y redimensiona bandas sin invertirlas', () => {
    expect(moveRange({ start: 2, end: 5 }, -5)).toEqual({ start: 0, end: 3 });
    expect(moveRange({ start: 2, end: 5 }, 10, 8)).toEqual({ start: 5, end: 8 });
    expect(resizeRange({ start: 2, end: 5 }, 'start', 10)).toEqual({ start: 4, end: 5 });
    expect(resizeRange({ start: 2, end: 5 }, 'end', -10)).toEqual({ start: 2, end: 3 });
    expect(resizeRange({ start: 2, end: 5 }, 'end', 2)).toEqual({ start: 2, end: 7 });
  });
  it('[RF-08] corta la línea según el rango', () => {
    expect(sliceLine('abcdef', 2, 4)).toBe('cd');
    expect(sliceLine('abcdef', 2, null)).toBe('cdef');
  });
});

describe('detección de solapes', () => {
  const fields = [
    { key: 'a', start: 0, end: 5, type: 'text' as const },
    { key: 'b', start: 4, end: 8, type: 'text' as const },
    { key: 'c', start: 10, end: null, type: 'text' as const },
    { key: 'g', group: 'x', type: 'text' as const },
    { key: 'k', constant: 'K', type: 'text' as const },
  ];
  it('[RF-08] solo considera campos posicionales', () => {
    expect(positionedFields(fields).map((f) => f.key)).toEqual(['a', 'b', 'c']);
  });
  it('[RF-08] detecta pares solapados y rangos abiertos', () => {
    expect(findOverlaps(fields)).toEqual([['a', 'b']]);
    expect(rangesOverlap({ start: 20, end: 25 }, { start: 10, end: null })).toBe(true);
    expect(overlapsWith(fields, { start: 3, end: 11 })).toEqual(['a', 'b', 'c']);
    expect(overlapsWith(fields, { start: 3, end: 6 }, 'a')).toEqual(['b']);
  });
});

describe('expresiones regulares', () => {
  it('[RF-07] traduce grupos con nombre de Python a JavaScript', () => {
    expect(pythonToJsRegex('(?P<cod>\\d+)(?P=cod)')).toBe('(?<cod>\\d+)\\k<cod>');
  });
  it('[RF-07] valida patrones y devuelve mensajes', () => {
    expect(validateRegex('^[A-Z]{2}\\d+')).toBeNull();
    expect(validateRegex('(')).toMatch(/.+/);
    expect(validateRegex('')).toBe('El patrón está vacío');
    expect(validateRegex('a'.repeat(501))).toMatch(/500/);
  });
  it('[RF-07] lista grupos con nombre', () => {
    expect(namedGroups('^(?P<a>x) (?<b>y)')).toEqual(['a', 'b']);
  });
  it('[RF-10] evalúa los tipos de coincidencia', () => {
    expect(matchesLocally({ type: 'regex', value: '^F-\\d+' }, 'F-000123')).toBe(true);
    expect(matchesLocally({ type: 'regex', value: '(' }, 'x')).toBe(false);
    expect(
      matchesLocally({ type: 'starts_with', value: 'total', ignore_case: true }, '  TOTAL: 5'),
    ).toBe(true);
    expect(matchesLocally({ type: 'contains', value: 'Zona' }, 'Vendedor X Zona: N')).toBe(true);
    expect(matchesLocally({ type: 'always', value: '' }, '   ')).toBe(false);
    expect(matchesLocally({ type: 'other', value: '' }, 'x')).toBe(false);
  });
});

describe('formato', () => {
  it('[RF-02] formatea tamaños y velocidades', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
    expect(formatBytes(-1)).toBe('—');
    expect(formatSpeed(2048)).toBe('2.0 KB/s');
    expect(formatPercent(0.425)).toBe('43%');
    expect(formatPercent(3)).toBe('100%');
  });
  it('[RF-12] formatea celdas según el tipo', () => {
    expect(formatCell(null)).toBe('');
    expect(formatCell('2026-02-01', 'date')).toBe('01/02/2026');
    expect(formatCell(1250.5, 'number')).toMatch(/1.?250,50/);
    expect(formatCell(7, 'integer')).toBe('7');
  });
});

describe('heurísticas varias', () => {
  it('[RF-09] adivina el tipo del texto seleccionado', () => {
    expect(guessType('01/02/2026')).toBe('date');
    expect(guessType('26/10/05')).toBe('date');
    expect(guessType('10')).toBe('integer');
    expect(guessType('1,250.50')).toBe('number');
    expect(guessType('(320.00)')).toBe('number');
    expect(guessType('COMERCIAL')).toBe('text');
    expect(guessType('  ')).toBe('text');
  });
  it('[RF-05] genera la regla de columnas', () => {
    const r = rulerText(25);
    expect(r).toHaveLength(25);
    expect(r.startsWith('0')).toBe(true);
    expect(r.slice(10, 12)).toBe('10');
    expect(r[5]).toBe('+');
  });
  it('[RF-10] asigna colores libres de la paleta', () => {
    expect(nextColor([])).toBe(RULE_PALETTE[0]);
    expect(nextColor([RULE_PALETTE[0]])).toBe(RULE_PALETTE[1]);
    expect(RULE_PALETTE).toContain(nextColor(RULE_PALETTE));
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });
  it('[RNF-02] debounce agrupa llamadas consecutivas', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(2);
    d(3);
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
