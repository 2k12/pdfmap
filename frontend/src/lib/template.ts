import type { Rule, Template } from '../api/types';

export const META_SOURCES = [
  { source: '@page', label: 'Página' },
  { source: '@line', label: 'Nº de línea' },
  { source: '@rule', label: 'Regla' },
  { source: '@raw', label: 'Línea completa' },
] as const;

export const ACTION_LABELS: Record<Rule['action'], string> = {
  row: 'Fila',
  context: 'Contexto',
  row_context: 'Fila + contexto',
  append: 'Anexar a fila anterior',
  check: 'Control de cuadre',
  skip: 'Ignorar',
};

export function blankTemplate(name = 'Nueva plantilla'): Template {
  return {
    name,
    description: '',
    version: 1,
    rules: [],
    columns: [],
    options: {
      sheet_name: 'Datos',
      totals_row: true,
      freeze_header: true,
      autofilter: true,
      header_color: '1F4E78',
      csv_delimiter: ';',
    },
  };
}

export interface SourceOption {
  source: string;
  label: string;
  ruleId: string | null;
  color: string;
}

/** Todas las fuentes que puede usar una columna: campos de reglas + metadatos. */
export function availableSources(t: Template): SourceOption[] {
  const out: SourceOption[] = [];
  for (const r of t.rules) {
    if (r.action === 'skip' || r.action === 'check') continue;
    for (const f of r.fields)
      out.push({
        source: `${r.id}.${f.key}`,
        label: f.label || f.key,
        ruleId: r.id,
        color: r.color ?? '#64748b',
      });
  }
  for (const m of META_SOURCES)
    out.push({ source: m.source, label: m.label, ruleId: null, color: '#64748b' });
  return out;
}

export function sourceLabel(t: Template, source: string): string {
  if (source.startsWith('@')) return META_SOURCES.find((m) => m.source === source)?.label ?? source;
  const [ruleId, key] = source.split('.', 2);
  const rule = t.rules.find((r) => r.id === ruleId);
  const field = rule?.fields.find((f) => f.key === key);
  return `${rule?.name ?? ruleId} · ${field?.label || key}`;
}

/** Copia profunda sin `undefined` (JSON limpio para el backend). */
export function cleanTemplate(t: Template): Template {
  return JSON.parse(JSON.stringify(t)) as Template;
}

/** Valida estructura básica en el cliente antes de enviar (el backend valida todo). */
export function localTemplateErrors(t: Template): string[] {
  const errors: string[] = [];
  if (!t.name.trim()) errors.push('La plantilla necesita un nombre');
  const ruleIds = new Set<string>();
  for (const r of t.rules) {
    if (ruleIds.has(r.id)) errors.push(`Regla duplicada: ${r.id}`);
    ruleIds.add(r.id);
    const keys = new Set<string>();
    for (const f of r.fields) {
      if (keys.has(f.key)) errors.push(`Campo duplicado en ${r.id}: ${f.key}`);
      keys.add(f.key);
    }
  }
  const valid = new Set(availableSources(t).map((s) => s.source));
  for (const c of t.columns)
    for (const s of c.sources)
      if (!valid.has(s)) errors.push(`La columna "${c.header}" usa una fuente inexistente: ${s}`);
  return errors;
}
