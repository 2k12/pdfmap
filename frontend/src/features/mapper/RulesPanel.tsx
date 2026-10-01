import { ACTION_LABELS } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';
import { RuleForm } from './RuleForm';

export function RulesPanel({ hits }: { hits?: Record<string, number> }) {
  const rules = useTemplateStore((s) => s.template.rules);
  const selectedId = useTemplateStore((s) => s.selectedRuleId);
  const selectRule = useTemplateStore((s) => s.selectRule);
  const addRule = useTemplateStore((s) => s.addRule);
  const removeRule = useTemplateStore((s) => s.removeRule);
  const moveRule = useTemplateStore((s) => s.moveRule);
  const selectedLine = useTemplateStore((s) => s.selectedLine);
  const selected = rules.find((r) => r.id === selectedId);

  return (
    <div className="rules">
      <div className="rules__head">
        <h3>Reglas</h3>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => addRule({ name: `Regla ${rules.length + 1}` })}
        >
          + Nueva regla
        </button>
      </div>
      <p className="muted small">Se evalúan en orden: la primera que coincide gana.</p>
      <ul className="rules__list" aria-label="Reglas">
        {rules.map((r, i) => (
          <li
            key={r.id}
            data-testid={`rule-item-${r.id}`}
            className={`rule-item ${r.id === selectedId ? 'rule-item--selected' : ''} ${r.enabled === false ? 'rule-item--disabled' : ''}`}
          >
            <button
              type="button"
              className="rule-item__main"
              aria-pressed={r.id === selectedId}
              onClick={() => selectRule(r.id)}
            >
              <span className="chip-dot" style={{ background: r.color }} aria-hidden="true" />
              <span className="rule-item__name">{r.name}</span>
              <span className="rule-item__meta">
                {ACTION_LABELS[r.action]} · {r.fields.length} campos
                {hits && ` · ${hits[r.id] ?? 0} coincid.`}
              </span>
            </button>
            <div className="rule-item__tools">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Subir ${r.name}`}
                disabled={i === 0}
                onClick={() => moveRule(i, i - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Bajar ${r.name}`}
                disabled={i === rules.length - 1}
                onClick={() => moveRule(i, i + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Eliminar ${r.name}`}
                onClick={() => {
                  if (window.confirm(`¿Eliminar la regla "${r.name}"?`)) removeRule(r.id);
                }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rules.length === 0 && (
        <p className="empty small">
          Selecciona una línea del documento y pulsa «Crear regla desde esta línea».
        </p>
      )}
      {selected && <RuleForm rule={selected} sampleLine={selectedLine?.text} />}
    </div>
  );
}
