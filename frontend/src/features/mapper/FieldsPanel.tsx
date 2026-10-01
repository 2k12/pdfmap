import { useState } from 'react';
import type { AnnotatedLine } from '../../api/types';
import { findOverlaps } from '../../lib/columns';
import { namedGroups } from '../../lib/regex';
import { useTemplateStore } from '../../store/templateStore';
import { FieldEditor } from './FieldEditor';
import { TYPE_LABELS } from './fieldMeta';

export function FieldsPanel({ annotation }: { annotation?: AnnotatedLine }) {
  const rule = useTemplateStore((s) => s.template.rules.find((r) => r.id === s.selectedRuleId));
  const updateField = useTemplateStore((s) => s.updateField);
  const removeField = useTemplateStore((s) => s.removeField);
  const addField = useTemplateStore((s) => s.addField);
  const selectedLine = useTemplateStore((s) => s.selectedLine);
  const [open, setOpen] = useState<string | null>(null);

  if (!rule) {
    return <p className="empty small">Selecciona una regla para ver y editar sus campos.</p>;
  }
  const overlaps = findOverlaps(rule.fields);
  const groups = rule.match.type === 'regex' ? namedGroups(rule.match.value) : [];

  return (
    <div className="fields">
      <div className="rules__head">
        <h3>Campos de «{rule.name}»</h3>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const key = addField(rule.id, {
              label: `Campo ${rule.fields.length + 1}`,
              start: 0,
              end: 10,
              type: 'text',
            });
            setOpen(key);
          }}
        >
          + Campo manual
        </button>
      </div>
      {rule.fields.length === 0 && (
        <p className="empty small">
          Arrastra sobre el texto de una línea para crear un campo, o usa «Detectar columnas».
        </p>
      )}
      {overlaps.length > 0 && (
        <p className="warning small" role="status">
          Campos solapados: {overlaps.map(([a, b]) => `${a}/${b}`).join(', ')}
        </p>
      )}
      <ul className="fields__list" aria-label="Campos">
        {rule.fields.map((f) => (
          <li key={f.key} className="field-item">
            <div className="field-item__head">
              <button
                type="button"
                className="link"
                aria-expanded={open === f.key}
                onClick={() => setOpen(open === f.key ? null : f.key)}
              >
                <strong>{f.label || f.key}</strong>{' '}
                <span className="muted small">
                  {f.key} · {TYPE_LABELS[f.type]} ·{' '}
                  {f.constant != null
                    ? `fijo "${f.constant}"`
                    : f.group
                      ? `grupo ${f.group}`
                      : `col ${f.start ?? 0}–${f.end ?? 'fin'}`}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Eliminar campo ${f.key}`}
                onClick={() => removeField(rule.id, f.key)}
              >
                ✕
              </button>
            </div>
            {annotation && annotation.rule === rule.id && (
              <div className="field-item__value small">
                Valor: <code className="mono">{formatValue(annotation.values[f.key])}</code>
              </div>
            )}
            {open === f.key && (
              <FieldEditor
                field={f}
                groups={groups}
                onChange={(patch) => {
                  updateField(rule.id, f.key, patch);
                  if (patch.key) setOpen(patch.key);
                }}
              />
            )}
          </li>
        ))}
      </ul>
      <section className="line-values" aria-label="Valores de la línea seleccionada">
        <h3>Línea seleccionada</h3>
        {!selectedLine && <p className="muted small">Ninguna.</p>}
        {selectedLine && !annotation && <p className="muted small">Sin análisis todavía.</p>}
        {selectedLine && annotation && (
          <>
            <p className="small">
              Regla: <strong>{annotation.rule ?? 'ninguna (se ignora)'}</strong>
            </p>
            {Object.keys(annotation.values).length > 0 && (
              <dl className="kv">
                {Object.entries(annotation.values).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="mono">{formatValue(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {annotation.errors.length > 0 && (
              <ul className="error small" role="alert">
                {annotation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅';
  return String(v);
}
