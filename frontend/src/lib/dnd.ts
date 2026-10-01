import type { Column } from '../api/types';

/** Lógica pura del fin de arrastre (testeable sin DOM). */
export function resolveDrop(
  active: { id: string; type: 'source' | 'column'; source?: string; label?: string },
  overId: string | null,
  columns: Column[],
):
  | { kind: 'add-column'; source: string; label: string }
  | { kind: 'add-source'; columnId: string; source: string }
  | { kind: 'move'; from: number; to: number }
  | null {
  if (!overId) return null;
  if (active.type === 'source' && active.source) {
    if (overId === 'columns-strip')
      return { kind: 'add-column', source: active.source, label: active.label ?? '' };
    const colId = overId.replace(/^col:/, '');
    if (columns.some((c) => c.id === colId))
      return { kind: 'add-source', columnId: colId, source: active.source };
    return null;
  }
  if (active.type === 'column') {
    const from = columns.findIndex((c) => `col:${c.id}` === active.id);
    const to = columns.findIndex((c) => `col:${c.id}` === overId);
    if (from >= 0 && to >= 0 && from !== to) return { kind: 'move', from, to };
  }
  return null;
}
