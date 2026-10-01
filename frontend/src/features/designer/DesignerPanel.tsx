import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useId } from 'react';
import type { Column } from '../../api/types';
import { ErrorMessage, Panel } from '../../components/ui';
import { withAlpha } from '../../lib/colors';
import { resolveDrop } from '../../lib/dnd';
import { availableSources, sourceLabel, type SourceOption } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';
import { usePreview } from '../mapper/hooks';
import { PreviewTable, StatsPanel } from './PreviewTable';

function SourceChip({ opt, onAdd }: { opt: SourceOption; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `src:${opt.source}`,
    data: { type: 'source', source: opt.source, label: opt.label },
  });
  return (
    <li>
      <span
        ref={setNodeRef}
        data-testid={`source-chip-${opt.source}`}
        className={`chip ${isDragging ? 'chip--dragging' : ''}`}
        style={{
          borderColor: opt.color,
          background: withAlpha(opt.color, 0.12),
          transform: CSS.Translate.toString(transform),
        }}
        {...listeners}
        {...attributes}
        aria-label={`Fuente ${opt.label}. Arrastra a la franja de columnas o pulsa el botón +`}
      >
        {opt.label}
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Agregar columna ${opt.label}`}
        onClick={onAdd}
      >
        +
      </button>
    </li>
  );
}

function ColumnCard({
  col,
  selected,
  onSelect,
}: {
  col: Column;
  selected: boolean;
  onSelect: () => void;
}) {
  const template = useTemplateStore((s) => s.template);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `col:${col.id}`,
      data: { type: 'column' },
    });
  return (
    <li
      ref={setNodeRef}
      data-testid={`column-${col.id}`}
      className={`col-card ${selected ? 'col-card--selected' : ''} ${isOver ? 'col-card--over' : ''} ${col.enabled === false ? 'col-card--disabled' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <span
        className="col-card__grip"
        {...listeners}
        {...attributes}
        aria-label={`Mover columna ${col.header}`}
      >
        ⠿
      </span>
      <button type="button" className="col-card__main" aria-pressed={selected} onClick={onSelect}>
        <strong>{col.header}</strong>
        <span className="small muted">
          {col.sources.map((s) => sourceLabel(template, s)).join(' / ') || 'sin fuente'}
        </span>
      </button>
    </li>
  );
}

function ColumnsStrip({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'columns-strip' });
  return (
    <ol
      ref={setNodeRef}
      data-testid="columns-strip"
      className={`columns-strip ${isOver ? 'columns-strip--over' : ''}`}
      aria-label="Columnas del Excel (en orden)"
    >
      {children}
    </ol>
  );
}

function ColumnEditor({ col }: { col: Column }) {
  const uid = useId();
  const template = useTemplateStore((s) => s.template);
  const updateColumn = useTemplateStore((s) => s.updateColumn);
  const removeColumn = useTemplateStore((s) => s.removeColumn);
  const addSource = useTemplateStore((s) => s.addSourceToColumn);
  const removeSource = useTemplateStore((s) => s.removeSourceFromColumn);
  const moveSource = useTemplateStore((s) => s.moveSource);
  const options = availableSources(template).filter((o) => !col.sources.includes(o.source));

  return (
    <form
      className="form col-editor"
      aria-label={`Editar columna ${col.header}`}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="form__grid">
        <div className="form__row">
          <label htmlFor={`${uid}-h`}>Encabezado</label>
          <input
            id={`${uid}-h`}
            value={col.header}
            onChange={(e) => updateColumn(col.id, { header: e.target.value })}
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-w`}>Ancho</label>
          <input
            id={`${uid}-w`}
            type="number"
            min={3}
            max={120}
            value={col.width ?? ''}
            onChange={(e) =>
              updateColumn(col.id, { width: e.target.value ? Number(e.target.value) : null })
            }
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-f`}>Formato Excel</label>
          <input
            id={`${uid}-f`}
            className="mono"
            list={`${uid}-fl`}
            placeholder="según tipo"
            value={col.number_format ?? ''}
            onChange={(e) => updateColumn(col.id, { number_format: e.target.value || null })}
          />
          <datalist id={`${uid}-fl`}>
            {['#,##0.00', '0', '0.00%', 'dd/mm/yyyy', 'yyyy-mm-dd', '@'].map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!col.total}
          onChange={(e) => updateColumn(col.id, { total: e.target.checked })}
        />
        Sumar en la fila de totales
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={col.enabled !== false}
          onChange={(e) => updateColumn(col.id, { enabled: e.target.checked })}
        />
        Incluir en el Excel
      </label>
      <fieldset className="form__group">
        <legend>Fuentes (se usa la primera con valor)</legend>
        <ol className="source-list">
          {col.sources.map((s, i) => (
            <li key={s}>
              <span className="chip">{sourceLabel(template, s)}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Subir fuente"
                disabled={i === 0}
                onClick={() => moveSource(col.id, i, i - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Bajar fuente"
                disabled={i === col.sources.length - 1}
                onClick={() => moveSource(col.id, i, i + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Quitar fuente ${s}`}
                onClick={() => removeSource(col.id, s)}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        {options.length > 0 && (
          <div className="form__row">
            <label htmlFor={`${uid}-add`}>Agregar fuente</label>
            <select
              id={`${uid}-add`}
              value=""
              onChange={(e) => e.target.value && addSource(col.id, e.target.value)}
            >
              <option value="">Elegir…</option>
              {options.map((o) => (
                <option key={o.source} value={o.source}>
                  {sourceLabel(template, o.source)}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>
      <button
        type="button"
        className="btn btn--danger btn--small"
        onClick={() => removeColumn(col.id)}
      >
        Eliminar columna
      </button>
    </form>
  );
}

function OptionsForm() {
  const uid = useId();
  const options = useTemplateStore((s) => s.template.options);
  const setOptions = useTemplateStore((s) => s.setOptions);
  return (
    <form className="form" aria-label="Opciones del Excel" onSubmit={(e) => e.preventDefault()}>
      <div className="form__grid">
        <div className="form__row">
          <label htmlFor={`${uid}-sheet`}>Nombre de la hoja</label>
          <input
            id={`${uid}-sheet`}
            maxLength={28}
            value={options.sheet_name ?? ''}
            onChange={(e) => setOptions({ sheet_name: e.target.value })}
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-color`}>Color de encabezado</label>
          <input
            id={`${uid}-color`}
            type="color"
            value={`#${(options.header_color ?? '1F4E78').replace('#', '')}`}
            onChange={(e) =>
              setOptions({ header_color: e.target.value.replace('#', '').toUpperCase() })
            }
          />
        </div>
        <div className="form__row">
          <label htmlFor={`${uid}-delim`}>Separador CSV</label>
          <select
            id={`${uid}-delim`}
            value={options.csv_delimiter ?? ';'}
            onChange={(e) => setOptions({ csv_delimiter: e.target.value })}
          >
            <option value=";">Punto y coma (;)</option>
            <option value=",">Coma (,)</option>
            <option value={'\t'}>Tabulador</option>
          </select>
        </div>
      </div>
      {(
        [
          ['totals_row', 'Fila de totales'],
          ['freeze_header', 'Inmovilizar encabezado'],
          ['autofilter', 'Autofiltro'],
        ] as const
      ).map(([k, label]) => (
        <label key={k} className="checkbox">
          <input
            type="checkbox"
            checked={options[k] !== false}
            onChange={(e) => setOptions({ [k]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </form>
  );
}

export function DesignerPanel({ fileId }: { fileId: string }) {
  const template = useTemplateStore((s) => s.template);
  const selectedColumnId = useTemplateStore((s) => s.selectedColumnId);
  const selectColumn = useTemplateStore((s) => s.selectColumn);
  const addColumn = useTemplateStore((s) => s.addColumn);
  const addSource = useTemplateStore((s) => s.addSourceToColumn);
  const moveColumn = useTemplateStore((s) => s.moveColumn);
  const preview = usePreview(fileId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sources = availableSources(template);
  const groups = new Map<string, SourceOption[]>();
  for (const s of sources) {
    const key = s.ruleId ?? '@meta';
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const selected = template.columns.find((c) => c.id === selectedColumnId);

  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as
      { type: 'source' | 'column'; source?: string; label?: string } | undefined;
    if (!data) return;
    const action = resolveDrop(
      { id: String(e.active.id), ...data },
      e.over ? String(e.over.id) : null,
      template.columns,
    );
    if (!action) return;
    if (action.kind === 'add-column') addColumn(action.source, action.label);
    if (action.kind === 'add-source') addSource(action.columnId, action.source);
    if (action.kind === 'move') moveColumn(action.from, action.to);
  };

  return (
    <div className="designer">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <Panel title="Fuentes disponibles" className="designer__palette">
          {sources.length <= 4 && (
            <p className="muted small">Crea reglas con campos para tener más fuentes.</p>
          )}
          {[...groups.entries()].map(([ruleId, opts]) => {
            const rule = template.rules.find((r) => r.id === ruleId);
            return (
              <div key={ruleId} className="palette-group">
                <h3 className="small">{rule ? rule.name : 'Metadatos'}</h3>
                <ul className="chips">
                  {opts.map((o) => (
                    <SourceChip key={o.source} opt={o} onAdd={() => addColumn(o.source, o.label)} />
                  ))}
                </ul>
              </div>
            );
          })}
        </Panel>
        <Panel title="Columnas del Excel" className="designer__columns">
          <p className="muted small">
            Arrastra una fuente a la franja para crear una columna, o sobre una columna para
            añadirla como alternativa. Arrastra las columnas por ⠿ para reordenarlas.
          </p>
          <SortableContext
            items={template.columns.map((c) => `col:${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <ColumnsStrip>
              {template.columns.map((c) => (
                <ColumnCard
                  key={c.id}
                  col={c}
                  selected={c.id === selectedColumnId}
                  onSelect={() => selectColumn(c.id === selectedColumnId ? null : c.id)}
                />
              ))}
              {template.columns.length === 0 && (
                <li className="empty small">Suelta aquí una fuente</li>
              )}
            </ColumnsStrip>
          </SortableContext>
          {selected && <ColumnEditor col={selected} />}
        </Panel>
      </DndContext>
      <Panel title="Opciones del Excel" className="designer__options">
        <OptionsForm />
      </Panel>
      <Panel
        title="Vista previa (primeras páginas)"
        className="designer__preview"
        actions={preview.isFetching ? <span className="small muted">Actualizando…</span> : null}
      >
        <ErrorMessage error={preview.error} />
        {!preview.data && !preview.isFetching && (
          <p className="muted small">
            Agrega al menos una regla y una columna para ver la vista previa.
          </p>
        )}
        {preview.data && (
          <>
            <StatsPanel stats={preview.data.stats} />
            <PreviewTable
              columns={preview.data.columns}
              rows={preview.data.rows}
              headerColor={template.options.header_color}
              caption="Vista previa del Excel"
            />
          </>
        )}
      </Panel>
    </div>
  );
}
