import type { Field } from '../api/types';

export interface PositionedField {
  key: string;
  start: number;
  end: number | null;
}

/** Campos que se extraen por posición (no por grupo regex ni constante). */
export function positionedFields(fields: Field[]): PositionedField[] {
  return fields
    .filter((f) => !f.group && (f.constant === undefined || f.constant === null))
    .map((f) => ({ key: f.key, start: f.start ?? 0, end: f.end ?? null }));
}

export function rangesOverlap(
  a: { start: number; end: number | null },
  b: { start: number; end: number | null },
): boolean {
  const aEnd = a.end ?? Infinity;
  const bEnd = b.end ?? Infinity;
  return a.start < bEnd && b.start < aEnd;
}

/** Pares de campos posicionales que se solapan. */
export function findOverlaps(fields: Field[]): Array<[string, string]> {
  const pos = positionedFields(fields);
  const out: Array<[string, string]> = [];
  for (let i = 0; i < pos.length; i++)
    for (let j = i + 1; j < pos.length; j++)
      if (rangesOverlap(pos[i], pos[j])) out.push([pos[i].key, pos[j].key]);
  return out;
}

/** Campos que se solapan con un rango candidato. */
export function overlapsWith(
  fields: Field[],
  range: { start: number; end: number | null },
  ignoreKey?: string,
): string[] {
  return positionedFields(fields)
    .filter((f) => f.key !== ignoreKey && rangesOverlap(f, range))
    .map((f) => f.key);
}
