import { useEffect, useRef, useState } from 'react';
import type { Field } from '../../api/types';
import { guessType } from '../../lib/guessType';
import { overlapsWith } from '../../lib/columns';
import { sliceLine } from '../../lib/selection';
import { useTemplateStore } from '../../store/templateStore';
import { FieldEditor } from './FieldEditor';

/** Diálogo "Nuevo campo" que aparece al seleccionar un rango de caracteres. */
export function NewFieldDialog({
  ruleId,
  start,
  end,
  lineText,
  onClose,
}: {
  ruleId: string;
  start: number;
  end: number;
  lineText: string;
  onClose: () => void;
}) {
  const rule = useTemplateStore((s) => s.template.rules.find((r) => r.id === ruleId));
  const addField = useTemplateStore((s) => s.addField);
  const sample = sliceLine(lineText, start, end).trim();
  const [field, setField] = useState<Field>(() => ({
    key: '',
    label: '',
    start,
    end,
    type: guessType(sample),
  }));
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  if (!rule) return null;
  const overlaps = overlapsWith(rule.fields, { start: field.start ?? 0, end: field.end ?? null });

  return (
    <div
      ref={dialogRef}
      className="dialog"
      role="dialog"
      aria-modal="false"
      aria-label="Nuevo campo"
      data-testid="new-field-dialog"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <h3>Nuevo campo en «{rule.name}»</h3>
      <p className="small">
        Columnas {field.start}–{field.end ?? 'fin'}:{' '}
        <code className="mono">{sample || '(vacío)'}</code>
      </p>
      <FieldEditor
        field={field}
        showKey={false}
        onChange={(p) => setField((f) => ({ ...f, ...p }))}
      />
      {overlaps.length > 0 && (
        <p className="warning small" role="status">
          Se solapa con: {overlaps.join(', ')}
        </p>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            addField(ruleId, { ...field, label: field.label || `Campo ${rule.fields.length + 1}` });
            onClose();
          }}
        >
          Agregar campo
        </button>
      </div>
    </div>
  );
}
