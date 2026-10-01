import { useId } from 'react';
import type { MatchType, Rule, RuleAction } from '../../api/types';
import { matchesLocally, namedGroups, validateRegex } from '../../lib/regex';
import { ID_PATTERN } from '../../lib/slugify';
import { ACTION_LABELS } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';

const MATCH_LABELS: Record<MatchType, string> = {
  regex: 'Expresión regular',
  starts_with: 'Empieza con',
  contains: 'Contiene',
  always: 'Cualquier línea con texto',
};

export function RuleForm({ rule, sampleLine }: { rule: Rule; sampleLine?: string }) {
  const uid = useId();
  const template = useTemplateStore((s) => s.template);
  const updateRule = useTemplateStore((s) => s.updateRule);
  const addField = useTemplateStore((s) => s.addField);
  const others = template.rules.filter((r) => r.id !== rule.id);
  const regexError = rule.match.type === 'regex' ? validateRegex(rule.match.value) : null;
  const idError = ID_PATTERN.test(rule.id)
    ? null
    : 'Solo minúsculas, números y _ (empieza por letra)';
  const groups = rule.match.type === 'regex' ? namedGroups(rule.match.value) : [];
  const missingGroups = groups.filter((g) => !rule.fields.some((f) => f.group === g));
  const sampleMatches =
    sampleLine !== undefined && !regexError ? matchesLocally(rule.match, sampleLine) : null;
  const columnIds = template.columns.map((c) => c.id);
  const checkFields = rule.fields.filter((f) => f.type === 'number' || f.type === 'integer');

  const setMatch = (patch: Partial<Rule['match']>) =>
    updateRule(rule.id, { match: { ...rule.match, ...patch } });

  return (
    <form
      className="form"
      aria-label={`Editar regla ${rule.name}`}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="form__row">
        <label htmlFor={`${uid}-name`}>Nombre</label>
        <input
          id={`${uid}-name`}
          value={rule.name}
          onChange={(e) => updateRule(rule.id, { name: e.target.value })}
        />
      </div>
      <div className="form__row">
        <label htmlFor={`${uid}-id`}>Identificador</label>
        <input
          id={`${uid}-id`}
          value={rule.id}
          aria-invalid={!!idError}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            if (ID_PATTERN.test(v) && !others.some((r) => r.id === v))
              updateRule(rule.id, { id: v });
          }}
        />
        {idError && <span className="error small">{idError}</span>}
      </div>
      <div className="form__row form__row--inline">
        <label htmlFor={`${uid}-color`}>Color</label>
        <input
          id={`${uid}-color`}
          type="color"
          value={rule.color ?? '#2563eb'}
          onChange={(e) => updateRule(rule.id, { color: e.target.value })}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={rule.enabled !== false}
            onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
          />
          Activa
        </label>
      </div>
      <div className="form__row">
        <label htmlFor={`${uid}-action`}>Acción</label>
        <select
          id={`${uid}-action`}
          value={rule.action}
          onChange={(e) => {
            const action = e.target.value as RuleAction;
            updateRule(rule.id, {
              action,
              check: action === 'check' ? (rule.check ?? { group: '', compare: [] }) : rule.check,
            });
          }}
        >
          {(Object.keys(ACTION_LABELS) as RuleAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="form__group">
        <legend>Cómo reconocer la línea</legend>
        <div className="form__row">
          <label htmlFor={`${uid}-mtype`}>Tipo</label>
          <select
            id={`${uid}-mtype`}
            value={rule.match.type}
            onChange={(e) => setMatch({ type: e.target.value as MatchType })}
          >
            {(Object.keys(MATCH_LABELS) as MatchType[]).map((m) => (
              <option key={m} value={m}>
                {MATCH_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {rule.match.type !== 'always' && (
          <div className="form__row">
            <label htmlFor={`${uid}-mvalue`}>Patrón</label>
            <input
              id={`${uid}-mvalue`}
              className="mono"
              value={rule.match.value}
              aria-invalid={!!regexError}
              aria-describedby={`${uid}-mhelp`}
              onChange={(e) => setMatch({ value: e.target.value })}
            />
            <span id={`${uid}-mhelp`} className={regexError ? 'error small' : 'muted small'}>
              {regexError
                ? `Patrón inválido: ${regexError}`
                : sampleMatches === null
                  ? 'Selecciona una línea para probar el patrón.'
                  : sampleMatches
                    ? '✓ La línea seleccionada coincide'
                    : '✗ La línea seleccionada no coincide'}
            </span>
          </div>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!rule.match.ignore_case}
            onChange={(e) => setMatch({ ignore_case: e.target.checked })}
          />
          Ignorar mayúsculas/minúsculas
        </label>
        {missingGroups.length > 0 && (
          <div className="hint">
            <span className="small">Grupos con nombre sin campo:</span>
            {missingGroups.map((g) => (
              <button
                key={g}
                type="button"
                className="btn btn--small"
                onClick={() => addField(rule.id, { key: g, label: g, group: g, type: 'text' })}
              >
                + {g}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      {others.length > 0 && (rule.action === 'context' || rule.action === 'row_context') && (
        <fieldset className="form__group">
          <legend>Al coincidir, borrar el contexto de</legend>
          {others.map((o) => (
            <label key={o.id} className="checkbox">
              <input
                type="checkbox"
                checked={rule.clears?.includes(o.id) ?? false}
                onChange={(e) =>
                  updateRule(rule.id, {
                    clears: e.target.checked
                      ? [...(rule.clears ?? []), o.id]
                      : (rule.clears ?? []).filter((c) => c !== o.id),
                  })
                }
              />
              {o.name}
            </label>
          ))}
        </fieldset>
      )}
      {rule.action === 'check' && (
        <fieldset className="form__group">
          <legend>Control de cuadre</legend>
          <div className="form__row">
            <label htmlFor={`${uid}-group`}>Reiniciar sumas cuando coincide</label>
            <select
              id={`${uid}-group`}
              value={rule.check?.group ?? ''}
              onChange={(e) =>
                updateRule(rule.id, {
                  check: { compare: [], ...rule.check, group: e.target.value },
                })
              }
            >
              <option value="">(desde el último control)</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          {checkFields.length === 0 && (
            <p className="muted small">
              Agrega campos numéricos (los totales impresos) para comparar.
            </p>
          )}
          {checkFields.map((f) => {
            const cmp = rule.check?.compare.find((c) => c.field === f.key);
            return (
              <div className="form__row" key={f.key}>
                <label htmlFor={`${uid}-cmp-${f.key}`}>
                  {f.label || f.key} = suma de la columna
                </label>
                <select
                  id={`${uid}-cmp-${f.key}`}
                  value={cmp?.sum_of ?? ''}
                  onChange={(e) => {
                    const rest = (rule.check?.compare ?? []).filter((c) => c.field !== f.key);
                    updateRule(rule.id, {
                      check: {
                        group: rule.check?.group ?? '',
                        ...rule.check,
                        compare: e.target.value
                          ? [...rest, { field: f.key, sum_of: e.target.value }]
                          : rest,
                      },
                    });
                  }}
                >
                  <option value="">(no comparar)</option>
                  {columnIds.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </fieldset>
      )}
    </form>
  );
}
