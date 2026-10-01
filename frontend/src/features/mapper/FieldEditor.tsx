import { useId } from 'react';
import type { Field, FieldType } from '../../api/types';
import { COMMON_DATE_FORMATS, TYPE_LABELS, fieldSource, type Source } from './fieldMeta';

/** Formulario controlado de un campo (sin estado propio). */
export function FieldEditor({
  field,
  onChange,
  groups = [],
  showKey = true,
}: {
  field: Field;
  onChange: (patch: Partial<Field>) => void;
  groups?: string[];
  showKey?: boolean;
}) {
  const uid = useId();
  const source = fieldSource(field);
  const setSource = (s: Source) => {
    if (s === 'position')
      onChange({ group: null, constant: null, start: field.start ?? 0, end: field.end ?? null });
    if (s === 'group') onChange({ constant: null, group: groups[0] ?? field.key });
    if (s === 'constant') onChange({ group: null, constant: field.constant ?? '' });
  };

  return (
    <div className="field-editor">
      <div className="form__grid">
        {showKey && (
          <div className="form__row">
            <label htmlFor={`${uid}-key`}>Clave</label>
            <input
              id={`${uid}-key`}
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value })}
            />
          </div>
        )}
        <div className="form__row">
          <label htmlFor={`${uid}-label`}>Etiqueta</label>
          <input
            id={`${uid}-label`}
            value={field.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-type`}>Tipo</label>
          <select
            id={`${uid}-type`}
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value as FieldType })}
          >
            {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-src`}>Origen</label>
          <select
            id={`${uid}-src`}
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
          >
            <option value="position">Posición (columnas)</option>
            <option value="group">Grupo de la regex</option>
            <option value="constant">Valor fijo</option>
          </select>
        </div>
        {source === 'position' && (
          <>
            <div className="form__row">
              <label htmlFor={`${uid}-start`}>Desde columna</label>
              <input
                id={`${uid}-start`}
                type="number"
                min={0}
                value={field.start ?? 0}
                onChange={(e) => onChange({ start: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="form__row">
              <label htmlFor={`${uid}-end`}>Hasta (vacío = fin de línea)</label>
              <input
                id={`${uid}-end`}
                type="number"
                min={1}
                value={field.end ?? ''}
                onChange={(e) =>
                  onChange({ end: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </div>
          </>
        )}
        {source === 'group' && (
          <div className="form__row">
            <label htmlFor={`${uid}-group`}>Grupo</label>
            <input
              id={`${uid}-group`}
              list={`${uid}-groups`}
              value={field.group ?? ''}
              onChange={(e) => onChange({ group: e.target.value })}
            />
            <datalist id={`${uid}-groups`}>
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        )}
        {source === 'constant' && (
          <div className="form__row">
            <label htmlFor={`${uid}-const`}>Valor fijo</label>
            <input
              id={`${uid}-const`}
              value={field.constant ?? ''}
              onChange={(e) => onChange({ constant: e.target.value })}
            />
          </div>
        )}
        {field.type === 'number' && (
          <div className="form__row">
            <label htmlFor={`${uid}-dec`}>Separador decimal</label>
            <select
              id={`${uid}-dec`}
              value={field.decimal ?? '.'}
              onChange={(e) => onChange({ decimal: e.target.value as '.' | ',' })}
            >
              <option value=".">Punto (1,234.56)</option>
              <option value=",">Coma (1.234,56)</option>
            </select>
          </div>
        )}
        {field.type === 'date' && (
          <div className="form__row">
            <label htmlFor={`${uid}-datefmt`}>Formato de fecha</label>
            <input
              id={`${uid}-datefmt`}
              className="mono"
              list={`${uid}-datefmts`}
              placeholder="automático"
              value={(field.date_formats ?? []).join(' | ')}
              onChange={(e) =>
                onChange({
                  date_formats: e.target.value
                    .split('|')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <datalist id={`${uid}-datefmts`}>
              {COMMON_DATE_FORMATS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        )}
        <div className="form__row">
          <label htmlFor={`${uid}-default`}>Valor si está vacío</label>
          <input
            id={`${uid}-default`}
            value={field.default ?? ''}
            onChange={(e) => onChange({ default: e.target.value || null })}
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-nulls`}>Tratar como vacío (separar con |)</label>
          <input
            id={`${uid}-nulls`}
            value={(field.null_values ?? []).join(' | ')}
            onChange={(e) =>
              onChange({
                null_values: e.target.value
                  .split('|')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        Obligatorio (si está vacío, la regla no coincide)
      </label>
    </div>
  );
}
