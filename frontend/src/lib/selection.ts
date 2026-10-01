export interface CharRange {
  start: number;
  end: number; // exclusivo
}

/** Rango normalizado a partir de dos índices de carácter (ancla y foco, ambos inclusivos). */
export function normalizeRange(anchor: number, focus: number): CharRange {
  const a = Math.max(0, Math.floor(anchor));
  const b = Math.max(0, Math.floor(focus));
  return { start: Math.min(a, b), end: Math.max(a, b) + 1 };
}

/** Índice de carácter bajo una coordenada X relativa al inicio de la línea. */
export function charIndexFromX(x: number, charWidth: number): number {
  if (charWidth <= 0) return 0;
  return Math.max(0, Math.floor(x / charWidth));
}

/** Desplaza un rango `delta` caracteres sin salirse de [0, maxEnd]. */
export function moveRange(range: CharRange, delta: number, maxEnd = Infinity): CharRange {
  const width = range.end - range.start;
  let start = Math.max(0, range.start + delta);
  if (start + width > maxEnd) start = Math.max(0, maxEnd - width);
  return { start, end: start + width };
}

/** Redimensiona por un borde manteniendo al menos 1 carácter. */
export function resizeRange(range: CharRange, edge: 'start' | 'end', delta: number): CharRange {
  if (edge === 'start') {
    const start = Math.min(Math.max(0, range.start + delta), range.end - 1);
    return { start, end: range.end };
  }
  const end = Math.max(range.end + delta, range.start + 1);
  return { start: range.start, end };
}

/** Texto de la línea dentro del rango (end null = hasta el final). */
export function sliceLine(text: string, start: number, end: number | null | undefined): string {
  return end == null ? text.slice(start) : text.slice(start, end);
}
