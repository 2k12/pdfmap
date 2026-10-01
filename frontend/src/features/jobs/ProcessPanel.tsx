import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import type { ExportFormat, JobOut } from '../../api/types';
import { ErrorMessage, Panel, ProgressBar, StatusBadge } from '../../components/ui';
import { cleanTemplate, localTemplateErrors } from '../../lib/template';
import { useTemplateStore } from '../../store/templateStore';
import { PreviewTable, StatsPanel } from '../designer/PreviewTable';

const PAGE_SIZE = 100;
const ACTIVE: JobOut['status'][] = ['queued', 'running'];

export function ProcessPanel({ fileId }: { fileId: string }) {
  const template = useTemplateStore((s) => s.template);
  const queryClient = useQueryClient();
  const [formats, setFormats] = useState<ExportFormat[]>(['xlsx']);
  const [jobId, setJobId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const localErrors = localTemplateErrors(template);

  const create = useMutation({
    mutationFn: () =>
      api.createJob({ file_id: fileId, template: cleanTemplate(template), formats }),
    onSuccess: (job) => {
      setJobId(job.id);
      setOffset(0);
      queryClient.setQueryData(['job', job.id], job);
    },
  });
  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data && ACTIVE.includes((q.state.data as JobOut).status) ? 1000 : false,
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelJob(jobId!),
    onSuccess: (j) => queryClient.setQueryData(['job', j.id], j),
  });
  const done = job.data?.status === 'done';
  const rows = useQuery({
    queryKey: ['job-rows', jobId, offset],
    queryFn: () => api.jobRows(jobId!, offset, PAGE_SIZE),
    enabled: !!jobId && done,
    placeholderData: keepPreviousData,
  });

  const toggle = (f: ExportFormat, on: boolean) =>
    setFormats((prev) => (on ? [...new Set([...prev, f])] : prev.filter((x) => x !== f)));

  const total = rows.data?.total ?? 0;
  return (
    <div className="process">
      <Panel title="Procesar el archivo completo">
        <fieldset className="form__group">
          <legend>Formatos de salida</legend>
          {(['xlsx', 'csv'] as ExportFormat[]).map((f) => (
            <label key={f} className="checkbox">
              <input
                type="checkbox"
                checked={formats.includes(f)}
                onChange={(e) => toggle(f, e.target.checked)}
              />
              {f.toUpperCase()}
            </label>
          ))}
        </fieldset>
        {localErrors.length > 0 && (
          <ul className="warning small" role="status">
            {localErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={
            formats.length === 0 ||
            template.columns.length === 0 ||
            create.isPending ||
            (!!job.data && ACTIVE.includes(job.data.status))
          }
          onClick={() => create.mutate()}
        >
          Procesar archivo completo
        </button>
        <ErrorMessage error={create.error || job.error || cancel.error} />
        {job.data && (
          <div className="job" aria-live="polite">
            <p>
              Trabajo <code>{job.data.id.slice(0, 8)}</code>{' '}
              <StatusBadge status={job.data.status} />{' '}
              {job.data.message && <span className="muted small">{job.data.message}</span>}
            </p>
            <ProgressBar
              value={job.data.progress}
              label="Progreso del procesamiento"
              testId="job-progress"
            />
            {ACTIVE.includes(job.data.status) && (
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => cancel.mutate()}
              >
                Cancelar
              </button>
            )}
            {done && (
              <div className="downloads">
                {job.data.formats.map((f) => (
                  <a
                    key={f}
                    className="btn btn--primary"
                    data-testid={`download-${f}`}
                    href={api.downloadUrl(job.data!.id, f)}
                    download
                  >
                    Descargar {f.toUpperCase()}
                  </a>
                ))}
              </div>
            )}
            {job.data.stats && <StatsPanel stats={job.data.stats} />}
          </div>
        )}
      </Panel>
      {done && rows.data && (
        <Panel title={`Resultados (${total.toLocaleString('es')} filas)`}>
          <nav className="pager" aria-label="Paginación de resultados">
            <button
              type="button"
              className="btn btn--small"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Anteriores
            </button>
            <span className="small">
              {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de{' '}
              {total.toLocaleString('es')}
            </span>
            <button
              type="button"
              className="btn btn--small"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Siguientes →
            </button>
          </nav>
          <PreviewTable
            columns={rows.data.columns}
            rows={rows.data.rows}
            headerColor={template.options.header_color}
            testId="results-table"
            startIndex={offset}
            caption="Resultados del procesamiento"
          />
        </Panel>
      )}
    </div>
  );
}
