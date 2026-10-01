import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { downloadJson, parseTemplateFile } from '../../lib/templateFile';
import { EmptyState, ErrorMessage, Panel } from '../../components/ui';

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileFor, setFileFor] = useState<Record<string, string>>({});
  const templates = useQuery({ queryKey: ['templates'], queryFn: api.listTemplates });
  const files = useQuery({ queryKey: ['files'], queryFn: api.listFiles });
  const ready = files.data?.filter((f) => f.status === 'ready') ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] });

  const clone = useMutation({
    mutationFn: async (id: string) => {
      const t = await api.getTemplate(id);
      const { id: _id, builtin: _b, ...rest } = t;
      void _id;
      void _b;
      return api.createTemplate({ ...rest, name: `${t.name} (copia)` });
    },
    onSuccess: (t) => {
      setMessage(`Plantilla «${t.name}» creada.`);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: api.deleteTemplate, onSuccess: refresh });
  const exportOne = useMutation({
    mutationFn: api.getTemplate,
    onSuccess: (t) => {
      const { id: _id, builtin: _b, ...rest } = t;
      void _id;
      void _b;
      downloadJson(t.name, rest);
    },
  });
  const importer = useMutation({
    mutationFn: async (file: File) => {
      const t = await parseTemplateFile(file);
      const { id: _id, builtin: _b, ...rest } = t;
      void _id;
      void _b;
      const res = await api.validateTemplate(rest);
      if (!res.valid) throw new Error(`Plantilla inválida: ${res.errors.join('; ')}`);
      return api.createTemplate(rest);
    },
    onSuccess: (t) => {
      setMessage(`Plantilla «${t.name}» importada.`);
      refresh();
    },
  });

  return (
    <div className="page">
      <Panel
        title="Plantillas de mapeo"
        actions={
          <>
            <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
              Importar JSON
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              hidden
              data-testid="template-import-input"
              aria-label="Importar plantilla JSON"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importer.mutate(f);
                e.target.value = '';
              }}
            />
          </>
        }
      >
        <p className="muted small">
          Una plantilla guarda cómo leer un formato de reporte. Reutilízala con cualquier archivo
          del mismo formato.
        </p>
        {message && (
          <p className="notice small" role="status">
            {message}
          </p>
        )}
        <ErrorMessage
          error={
            templates.error || clone.error || remove.error || importer.error || exportOne.error
          }
        />
        {templates.data?.length === 0 && <EmptyState>No hay plantillas todavía.</EmptyState>}
        {templates.data && templates.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Descripción</th>
                <th scope="col">Abrir con archivo</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.data.map((t) => (
                <tr key={t.id} data-testid="template-row">
                  <td>
                    {t.name} {t.builtin && <span className="badge">ejemplo</span>}
                  </td>
                  <td className="small">{t.description}</td>
                  <td>
                    <div className="inline-form">
                      <label htmlFor={`open-${t.id}`} className="sr-only">
                        Archivo para {t.name}
                      </label>
                      <select
                        id={`open-${t.id}`}
                        value={fileFor[t.id] ?? ''}
                        onChange={(e) => setFileFor({ ...fileFor, [t.id]: e.target.value })}
                      >
                        <option value="">Elegir archivo…</option>
                        {ready.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--small btn--primary"
                        disabled={!fileFor[t.id]}
                        onClick={() => navigate(`/files/${fileFor[t.id]}/map?template=${t.id}`)}
                      >
                        Abrir
                      </button>
                    </div>
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => clone.mutate(t.id)}
                    >
                      Clonar
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => exportOne.mutate(t.id)}
                    >
                      Exportar JSON
                    </button>
                    {!t.builtin && (
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        aria-label={`Eliminar plantilla ${t.name}`}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la plantilla «${t.name}»?`))
                            remove.mutate(t.id);
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
