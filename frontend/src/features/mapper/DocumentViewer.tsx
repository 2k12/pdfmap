import { useMutation } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { api } from '../../api/client';
import type { AnnotatedLine, PageLine, SearchMatch } from '../../api/types';
import { ErrorMessage } from '../../components/ui';
import { withAlpha } from '../../lib/colors';
import { overlapsWith, positionedFields } from '../../lib/columns';
import { rulerText } from '../../lib/ruler';
import { matchesLocally } from '../../lib/regex';
import { moveRange, normalizeRange, resizeRange, type CharRange } from '../../lib/selection';
import { useTemplateStore } from '../../store/templateStore';
import { NewFieldDialog } from './NewFieldDialog';

interface Props {
  fileId: string;
  page: number;
  pages: number;
  lines: PageLine[];
  annotations: Map<number, AnnotatedLine>;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

interface DragSel {
  n: number;
  anchor: number;
  focus: number;
}

const GUTTER = 6; // ancho (en ch) de la columna con números de línea

export function DocumentViewer({
  fileId,
  page,
  pages,
  lines,
  annotations,
  loading,
  onPageChange,
}: Props) {
  const template = useTemplateStore((s) => s.template);
  const selectedRuleId = useTemplateStore((s) => s.selectedRuleId);
  const selectedLine = useTemplateStore((s) => s.selectedLine);
  const selectLine = useTemplateStore((s) => s.selectLine);
  const addRule = useTemplateStore((s) => s.addRule);
  const addField = useTemplateStore((s) => s.addField);
  const updateField = useTemplateStore((s) => s.updateField);
  const rule = template.rules.find((r) => r.id === selectedRuleId) ?? null;
  const colorOf = useMemo(
    () => new Map(template.rules.map((r) => [r.id, r.color ?? '#64748b'])),
    [template.rules],
  );

  const [drag, setDrag] = useState<DragSel | null>(null);
  const [pending, setPending] = useState<{ range: CharRange; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState(String(page));
  const [tokens, setTokens] = useState(1);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [charPx, setCharPx] = useState(8);

  useEffect(() => setPageInput(String(page)), [page]);
  useLayoutEffect(() => {
    const w = measureRef.current?.getBoundingClientRect().width ?? 0;
    if (w > 0) setCharPx(w / 10);
  }, []);

  const maxLen = useMemo(() => Math.max(80, ...lines.map((l) => l.text.length)) + 2, [lines]);

  // -- Selección de rango con el ratón -----------------------------------------------------
  const finishDrag = useCallback(() => {
    setDrag((d) => {
      if (d && d.anchor !== d.focus) {
        const text = lines.find((l) => l.n === d.n)?.text ?? '';
        if (!selectedRuleId)
          setNotice('Primero crea o selecciona una regla para agregarle campos.');
        else setPending({ range: normalizeRange(d.anchor, d.focus), text });
      }
      return null;
    });
  }, [lines, selectedRuleId]);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
  }, [drag, finishDrag]);

  const colFromEvent = (e: MouseEvent) => {
    const col = (e.target as HTMLElement).dataset.col;
    return col === undefined ? null : Number(col);
  };

  // -- Acciones -----------------------------------------------------------------------------
  const suggest = useMutation({
    mutationFn: (text: string) => api.suggestRegex(text, tokens),
    onSuccess: ({ regex }) => {
      addRule({
        name: `Regla ${template.rules.length + 1}`,
        match: { type: 'regex', value: regex },
      });
      setNotice('Regla creada. Ajusta su nombre, acción y patrón en el panel izquierdo.');
    },
  });

  const detect = useMutation({
    mutationFn: async () => {
      if (!rule) throw new Error('Selecciona una regla');
      const matched = lines.filter((l) => {
        const a = annotations.get(l.n);
        return a ? a.rule === rule.id : matchesLocally(rule.match, l.text);
      });
      if (matched.length === 0)
        throw new Error('Ninguna línea de esta página coincide con la regla.');
      const { segments } = await api.suggestColumns(matched.map((l) => l.text));
      let added = 0;
      for (const seg of segments) {
        if (overlapsWith(rule.fields, seg).length) continue;
        addField(rule.id, {
          label: `Campo ${rule.fields.length + added + 1}`,
          start: seg.start,
          end: seg.end,
          type: seg.type,
          date_formats: seg.date_formats,
          decimal: seg.decimal,
        });
        added++;
      }
      return added;
    },
    onSuccess: (added) => setNotice(`${added} campos detectados.`),
  });

  const [query, setQuery] = useState('');
  const [regexMode, setRegexMode] = useState(false);
  const search = useMutation({
    mutationFn: () => api.search(fileId, query, regexMode ? 'regex' : 'contains'),
  });
  const jumpTo = (m: SearchMatch) => {
    onPageChange(m.page);
    selectLine({ page: m.page, n: m.n, text: m.text });
  };

  const goPage = (p: number) => {
    if (Number.isFinite(p)) onPageChange(Math.min(Math.max(1, Math.round(p)), pages));
  };

  // -- Bandas de campos (arrastrar / redimensionar) -----------------------------------------
  const [bandDrag, setBandDrag] = useState<{
    key: string;
    mode: 'move' | 'start' | 'end';
    x0: number;
    orig: CharRange;
    current: CharRange;
  } | null>(null);
  const bands = rule ? positionedFields(rule.fields) : [];

  const onBandPointerDown = (e: PointerEvent, key: string, mode: 'move' | 'start' | 'end') => {
    const f = bands.find((b) => b.key === key);
    if (!f) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const orig = { start: f.start, end: f.end ?? maxLen };
    setBandDrag({ key, mode, x0: e.clientX, orig, current: orig });
  };
  const onBandPointerMove = (e: PointerEvent) => {
    if (!bandDrag) return;
    const delta = Math.round((e.clientX - bandDrag.x0) / charPx);
    const current =
      bandDrag.mode === 'move'
        ? moveRange(bandDrag.orig, delta)
        : resizeRange(bandDrag.orig, bandDrag.mode, delta);
    setBandDrag({ ...bandDrag, current });
  };
  const onBandPointerUp = () => {
    if (!bandDrag || !rule) return;
    const f = rule.fields.find((x) => x.key === bandDrag.key);
    const wasOpen = f?.end == null && bandDrag.mode !== 'end' && bandDrag.mode !== 'move';
    updateField(rule.id, bandDrag.key, {
      start: bandDrag.current.start,
      end: wasOpen ? null : bandDrag.current.end,
    });
    setBandDrag(null);
  };
  const onBandKey = (e: KeyboardEvent, key: string) => {
    if (!rule) return;
    const f = rule.fields.find((x) => x.key === key);
    if (!f) return;
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const r = { start: f.start ?? 0, end: f.end ?? maxLen };
    const next = e.shiftKey
      ? resizeRange(r, 'end', delta)
      : e.altKey
        ? resizeRange(r, 'start', delta)
        : moveRange(r, delta);
    updateField(rule.id, key, {
      start: next.start,
      end: f.end == null && !e.shiftKey ? null : next.end,
    });
  };

  const selRange = drag ? normalizeRange(drag.anchor, drag.focus) : null;

  return (
    <div className="viewer" style={{ ['--gutter' as string]: `${GUTTER}ch` }}>
      <div className="viewer__toolbar" role="toolbar" aria-label="Navegación del documento">
        <button
          type="button"
          className="btn btn--small"
          disabled={page <= 1}
          onClick={() => goPage(page - 1)}
        >
          ← Anterior
        </button>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            goPage(Number(pageInput));
          }}
        >
          <label htmlFor="page-input">Página</label>
          <input
            id="page-input"
            className="input--narrow"
            type="number"
            min={1}
            max={pages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
          />
          <span>de {pages}</span>
          <button type="submit" className="btn btn--small">
            Ir
          </button>
        </form>
        <button
          type="button"
          className="btn btn--small"
          disabled={page >= pages}
          onClick={() => goPage(page + 1)}
        >
          Siguiente →
        </button>
        <form
          className="inline-form viewer__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) search.mutate();
          }}
        >
          <label htmlFor="search-input" className="sr-only">
            Buscar en el documento
          </label>
          <input
            id="search-input"
            placeholder="Buscar en todo el documento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="checkbox small">
            <input
              type="checkbox"
              checked={regexMode}
              onChange={(e) => setRegexMode(e.target.checked)}
            />
            regex
          </label>
          <button type="submit" className="btn btn--small">
            Buscar
          </button>
        </form>
      </div>
      {search.data && (
        <div className="search-results" aria-label="Resultados de búsqueda">
          <span className="small muted">
            {search.data.matches.length} resultados{search.data.truncated ? ' (truncado)' : ''}
          </span>
          <ul>
            {search.data.matches.map((m) => (
              <li key={`${m.page}-${m.n}`}>
                <button type="button" className="link" onClick={() => jumpTo(m)}>
                  p.{m.page} l.{m.n}: <code className="mono">{m.text.trim().slice(0, 90)}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ErrorMessage error={search.error || suggest.error || detect.error} />

      <div className="viewer__actions">
        <span className="small muted">
          {selectedLine
            ? `Línea seleccionada: p.${selectedLine.page} l.${selectedLine.n}`
            : 'Haz clic en una línea para seleccionarla; arrastra sobre el texto para crear un campo.'}
        </span>
        <label className="small">
          Tokens del patrón{' '}
          <select
            value={tokens}
            onChange={(e) => setTokens(Number(e.target.value))}
            aria-label="Tokens del patrón"
          >
            {[1, 2, 3, 4].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={!selectedLine || suggest.isPending}
          onClick={() => selectedLine && suggest.mutate(selectedLine.text)}
        >
          Crear regla desde esta línea
        </button>
        <button
          type="button"
          className="btn btn--small"
          disabled={!rule || detect.isPending}
          onClick={() => detect.mutate()}
        >
          Detectar columnas
        </button>
      </div>
      {notice && (
        <p className="notice small" role="status">
          {notice}{' '}
          <button
            type="button"
            className="link"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </p>
      )}

      <div className={`doc ${loading ? 'doc--loading' : ''}`} aria-busy={loading}>
        <span ref={measureRef} className="doc__measure" aria-hidden="true">
          0000000000
        </span>
        <div className="doc__ruler" data-testid="ruler" aria-hidden="true">
          <span className="doc__gutter" />
          <span className="doc__ruler-text">{rulerText(maxLen)}</span>
        </div>
        {rule && bands.length > 0 && (
          <div
            className="doc__bands"
            aria-label={`Campos de ${rule.name}`}
            onPointerMove={onBandPointerMove}
            onPointerUp={onBandPointerUp}
          >
            {bands.map((b) => {
              const r =
                bandDrag?.key === b.key
                  ? bandDrag.current
                  : { start: b.start, end: b.end ?? maxLen };
              const color = rule.color ?? '#2563eb';
              return (
                <div
                  key={b.key}
                  data-testid={`field-band-${b.key}`}
                  className="band"
                  role="slider"
                  tabIndex={0}
                  aria-label={`Campo ${b.key}: columnas ${r.start} a ${b.end ?? 'fin'}. Flechas mueven, Mayús+flechas cambian el final, Alt+flechas el inicio`}
                  aria-valuemin={0}
                  aria-valuemax={maxLen}
                  aria-valuenow={r.start}
                  style={{
                    left: `calc(var(--gutter) + ${r.start}ch)`,
                    width: `${r.end - r.start}ch`,
                    background: withAlpha(color, 0.25),
                    borderColor: color,
                  }}
                  onPointerDown={(e) => onBandPointerDown(e, b.key, 'move')}
                  onKeyDown={(e) => onBandKey(e, b.key)}
                >
                  <span
                    className="band__handle band__handle--start"
                    onPointerDown={(e) => onBandPointerDown(e, b.key, 'start')}
                  />
                  <span className="band__label">{b.key}</span>
                  <span
                    className="band__handle band__handle--end"
                    onPointerDown={(e) => onBandPointerDown(e, b.key, 'end')}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="doc__lines" role="listbox" aria-label={`Líneas de la página ${page}`}>
          {lines.map((l) => {
            const ann = annotations.get(l.n);
            const color = ann?.rule ? colorOf.get(ann.rule) : undefined;
            const isSelected = selectedLine?.page === page && selectedLine.n === l.n;
            const padded = l.text.padEnd(maxLen, ' ');
            return (
              <div
                key={l.n}
                data-testid={`doc-line-${l.n}`}
                className={`doc-line ${isSelected ? 'doc-line--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                title={ann?.rule ? `Regla: ${ann.rule}` : undefined}
                style={
                  color
                    ? { background: withAlpha(color, 0.14), boxShadow: `inset 3px 0 0 ${color}` }
                    : undefined
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectLine({ page, n: l.n, text: l.text });
                  }
                }}
                onClick={() => selectLine({ page, n: l.n, text: l.text })}
              >
                <span className="doc__gutter">
                  {l.n}
                  {ann?.rule && <span className="sr-only"> regla {ann.rule}</span>}
                </span>
                <span
                  className="doc-line__text"
                  onMouseDown={(e) => {
                    const col = colFromEvent(e);
                    if (col === null || e.button !== 0) return;
                    e.preventDefault();
                    selectLine({ page, n: l.n, text: l.text });
                    setDrag({ n: l.n, anchor: col, focus: col });
                  }}
                  onMouseOver={(e) => {
                    if (!drag || drag.n !== l.n) return;
                    const col = colFromEvent(e);
                    if (col !== null && col !== drag.focus) setDrag({ ...drag, focus: col });
                  }}
                >
                  {Array.from(padded, (ch, i) => (
                    <span
                      key={i}
                      data-col={i}
                      className={
                        drag?.n === l.n && selRange && i >= selRange.start && i < selRange.end
                          ? 'ch ch--sel'
                          : 'ch'
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
          {lines.length === 0 && !loading && <p className="empty">Página sin texto.</p>}
        </div>
      </div>
      {pending && selectedRuleId && (
        <NewFieldDialog
          ruleId={selectedRuleId}
          start={pending.range.start}
          end={pending.range.end}
          lineText={pending.text}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
