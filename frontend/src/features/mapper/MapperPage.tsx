import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { AnnotatedLine, Template } from '../../api/types';
import { ErrorMessage } from '../../components/ui';
import { blankTemplate, cleanTemplate } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';
import { DesignerPanel } from '../designer/DesignerPanel';
import { ProcessPanel } from '../jobs/ProcessPanel';
import { DocumentViewer } from './DocumentViewer';
import { FieldsPanel } from './FieldsPanel';
import { useAnnotate, usePage } from './hooks';
import { RulesPanel } from './RulesPanel';

type Tab = 'rules' | 'designer' | 'process';
const TABS: Array<[Tab, string]> = [
  ['rules', '1. Reglas y campos'],
  ['designer', '2. Diseño Excel'],
  ['process', '3. Procesar'],
];

export function MapperPage() {
  const { fileId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const templateId = params.get('template');
  const [tab, setTab] = useState<Tab>('rules');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const template = useTemplateStore((s) => s.template);
  const dirty = useTemplateStore((s) => s.dirty);
  const load = useTemplateStore((s) => s.load);
  const markSaved = useTemplateStore((s) => s.markSaved);
  const setMeta = useTemplateStore((s) => s.setMeta);
  const selectedLine = useTemplateStore((s) => s.selectedLine);

  const file = useQuery({ queryKey: ['file', fileId], queryFn: () => api.getFile(fileId) });
  const templates = useQuery({ queryKey: ['templates'], queryFn: api.listTemplates });
  const loaded = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => api.getTemplate(templateId!),
    enabled: !!templateId,
  });

  useEffect(() => {
    if (!templateId) load(blankTemplate());
  }, [templateId, load]);
  useEffect(() => {
    if (loaded.data) load(loaded.data);
  }, [loaded.data, load]);

  const pageQuery = usePage(fileId, page);
  const annotate = useAnnotate(fileId, page);
  const annotations = useMemo(() => {
    const map = new Map<number, AnnotatedLine>();
    if (annotate.data?.page === page) for (const l of annotate.data.lines) map.set(l.n, l);
    return map;
  }, [annotate.data, page]);
  const hits = useMemo(() => {
    const h: Record<string, number> = {};
    for (const l of annotations.values()) if (l.rule) h[l.rule] = (h[l.rule] ?? 0) + 1;
    return h;
  }, [annotations]);

  const save = useMutation({
    mutationFn: async (): Promise<Template> => {
      const body = cleanTemplate(template);
      if (body.id && !body.builtin) return api.updateTemplate(body.id, body);
      const { id: _id, builtin, ...rest } = body;
      void _id;
      return api.createTemplate({
        ...rest,
        name: builtin ? `${rest.name} (copia)` : rest.name,
      } as Template);
    },
    onSuccess: (saved) => {
      markSaved(saved);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.setQueryData(['template', saved.id], saved);
      if (saved.id && saved.id !== templateId) setParams({ template: saved.id });
    },
  });

  const changeTemplate = (id: string) => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    if (id) setParams({ template: id });
    else {
      setParams({});
      load(blankTemplate());
    }
  };

  const pages = file.data?.pages ?? pageQuery.data?.pages ?? 1;

  return (
    <div className="mapper">
      <header className="mapper__header">
        <div>
          <Link to="/" className="small">
            ← Archivos
          </Link>
          <h1>{file.data?.name ?? 'Archivo'}</h1>
        </div>
        <div className="mapper__template">
          <label htmlFor="template-select">Plantilla</label>
          <select
            id="template-select"
            value={templateId ?? ''}
            onChange={(e) => changeTemplate(e.target.value)}
          >
            <option value="">Nueva en blanco</option>
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.builtin ? ' (ejemplo)' : ''}
              </option>
            ))}
          </select>
          <label htmlFor="template-name" className="sr-only">
            Nombre de la plantilla
          </label>
          <input
            id="template-name"
            value={template.name}
            onChange={(e) => setMeta({ name: e.target.value })}
            placeholder="Nombre de la plantilla"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => save.mutate()}
            disabled={save.isPending || !template.name.trim()}
          >
            {template.builtin
              ? 'Guardar como copia'
              : dirty
                ? 'Guardar plantilla*'
                : 'Guardar plantilla'}
          </button>
        </div>
      </header>
      <ErrorMessage error={file.error || loaded.error || save.error || annotate.error} />
      {save.isSuccess && !dirty && (
        <p className="notice small" role="status">
          Plantilla guardada.
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Pasos del mapeo">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            className={`tab ${tab === id ? 'tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'rules' && (
          <div className="mapper__grid">
            <aside className="mapper__left" aria-label="Reglas">
              <RulesPanel hits={hits} />
            </aside>
            <main className="mapper__center">
              <ErrorMessage error={pageQuery.error} />
              <DocumentViewer
                fileId={fileId}
                page={page}
                pages={pages}
                lines={pageQuery.data?.lines ?? []}
                annotations={annotations}
                loading={pageQuery.isFetching}
                onPageChange={setPage}
              />
            </main>
            <aside className="mapper__right" aria-label="Campos">
              <FieldsPanel
                annotation={
                  selectedLine && selectedLine.page === page
                    ? annotations.get(selectedLine.n)
                    : undefined
                }
              />
            </aside>
          </div>
        )}
        {tab === 'designer' && <DesignerPanel fileId={fileId} />}
        {tab === 'process' && <ProcessPanel fileId={fileId} />}
      </div>
    </div>
  );
}
