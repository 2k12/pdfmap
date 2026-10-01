import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type DragEvent } from 'react';
import type { FileOut } from '../../api/types';
import { ErrorMessage, ProgressBar } from '../../components/ui';
import { formatBytes, formatSpeed } from '../../lib/format';
import { ACCEPTED_EXTENSIONS, uploadFile, validateFile, type UploadProgress } from './uploader';

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: UploadProgress | null;
  error: string | null;
  done: boolean;
  controller: AbortController;
}

export function Dropzone({ onUploaded }: { onUploaded?: (f: FileOut) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const queryClient = useQueryClient();

  const patch = (id: string, p: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const start = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const controller = new AbortController();
      const error = validateFile(file);
      setItems((prev) => [
        ...prev,
        { id, name: file.name, size: file.size, progress: null, error, done: false, controller },
      ]);
      if (error) continue;
      uploadFile(file, {
        signal: controller.signal,
        onProgress: (progress) => patch(id, { progress }),
      })
        .then((result) => {
          patch(id, { done: true });
          queryClient.invalidateQueries({ queryKey: ['files'] });
          onUploaded?.(result);
        })
        .catch((err: unknown) => {
          const aborted = (err as { name?: string } | null)?.name === 'AbortError';
          patch(id, {
            error: aborted ? 'Subida cancelada' : err instanceof Error ? err.message : String(err),
          });
        });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) start(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        data-testid="dropzone"
        className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="dropzone__title">Arrastra aquí tu reporte PDF o TXT</p>
        <p className="muted">
          Cualquier formato con texto seleccionable. Archivos pesados se suben por fragmentos.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivo
        </button>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          multiple
          hidden
          aria-label="Seleccionar archivo"
          onChange={(e) => {
            if (e.target.files?.length) start(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="upload-list" aria-label="Subidas">
          {items.map((it) => (
            <li key={it.id} className="upload-item" data-testid="upload-progress">
              <div className="upload-item__head">
                <strong>{it.name}</strong>
                <span className="muted">{formatBytes(it.size)}</span>
                {!it.done && !it.error && (
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => it.controller.abort()}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {it.error ? (
                <ErrorMessage error={it.error} />
              ) : (
                <>
                  <ProgressBar
                    value={
                      it.done
                        ? 1
                        : it.progress
                          ? it.progress.loaded / Math.max(1, it.progress.total)
                          : 0
                    }
                    label={`Progreso de subida de ${it.name}`}
                  />
                  <span className="muted small">
                    {it.done
                      ? 'Subida completa. Extrayendo texto…'
                      : it.progress
                        ? `${formatBytes(it.progress.loaded)} de ${formatBytes(it.progress.total)} · ${formatSpeed(it.progress.speed)} · fragmento ${it.progress.chunksDone}/${it.progress.totalChunks}`
                        : 'Preparando…'}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
