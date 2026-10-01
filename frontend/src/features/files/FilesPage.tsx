import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { FileOut } from '../../api/types';
import { EmptyState, ErrorMessage, Panel, ProgressBar, StatusBadge } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { Dropzone } from '../upload/Dropzone';

export function FilesPage() {
  const queryClient = useQueryClient();
  const files = useQuery({
    queryKey: ['files'],
    queryFn: api.listFiles,
    refetchInterval: (q) =>
      (q.state.data as FileOut[] | undefined)?.some(
        (f) => f.status === 'extracting' || f.status === 'uploaded',
      )
        ? 1000
        : false,
  });
  const remove = useMutation({
    mutationFn: api.deleteFile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });

  return (
    <div className="page">
      <Panel title="Cargar reporte">
        <Dropzone />
      </Panel>
      <Panel title="Archivos">
        <ErrorMessage error={files.error || remove.error} />
        {files.isLoading && <p>Cargando…</p>}
        {files.data && files.data.length === 0 && (
          <EmptyState>Aún no hay archivos. Sube un PDF para empezar a mapearlo.</EmptyState>
        )}
        {files.data && files.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tamaño</th>
                <th scope="col">Estado</th>
                <th scope="col">Páginas</th>
                <th scope="col">Líneas</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {files.data.map((f) => (
                <tr key={f.id} data-testid="file-row">
                  <td>{f.name}</td>
                  <td>{formatBytes(f.size)}</td>
                  <td>
                    <StatusBadge status={f.status} />
                    {f.status === 'extracting' && (
                      <ProgressBar value={f.progress} label={`Extracción de ${f.name}`} />
                    )}
                    {f.error && <span className="error small">{f.error}</span>}
                  </td>
                  <td>{f.pages ?? '—'}</td>
                  <td>{f.lines?.toLocaleString('es') ?? '—'}</td>
                  <td className="actions">
                    {f.status === 'ready' ? (
                      <Link className="btn btn--primary btn--small" to={`/files/${f.id}/map`}>
                        Mapear
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      aria-label={`Eliminar ${f.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${f.name}" y sus resultados?`))
                          remove.mutate(f.id);
                      }}
                    >
                      Eliminar
                    </button>
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
