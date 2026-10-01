import { api } from '../../api/client';
import type { FileOut } from '../../api/types';
import { pendingChunks, planChunks, uploadedBytes } from '../../lib/chunks';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.prn'];
export const DEFAULT_MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB (el backend aplica su propio límite)

export interface UploadProgress {
  loaded: number;
  total: number;
  speed: number; // bytes/s
  chunksDone: number;
  totalChunks: number;
}

export interface UploadOptions {
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
  onProgress?: (p: UploadProgress) => void;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now?: () => number;
}

/** Valida extensión y tamaño. Devuelve un mensaje de error o null. */
export function validateFile(
  file: { name: string; size: number },
  maxSize = DEFAULT_MAX_SIZE,
): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext))
    return `Tipo de archivo no soportado (${ext || 'sin extensión'}). Usa PDF o TXT.`;
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > maxSize) return 'El archivo supera el tamaño máximo permitido.';
  return null;
}

export function resumeKey(file: File): string {
  return `pdfmap:upload:${file.name}:${file.size}:${file.lastModified}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sube un archivo por fragmentos con concurrencia, reintentos y reanudación.
 * Guarda el upload_id en `storage` para continuar si se interrumpe.
 */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<FileOut> {
  const {
    concurrency = 3,
    retries = 3,
    retryDelayMs = 500,
    signal,
    onProgress,
    storage = globalThis.localStorage,
    now = () => performance.now(),
  } = opts;

  const key = resumeKey(file);
  let uploadId = storage?.getItem(key) ?? null;
  let chunkSize = 0;
  let received: number[] = [];

  if (uploadId) {
    try {
      const st = await api.uploadStatus(uploadId);
      chunkSize = st.chunk_size;
      received = st.received;
    } catch {
      uploadId = null;
    }
  }
  if (!uploadId) {
    const init = await api.initUpload(file.name, file.size);
    uploadId = init.upload_id;
    chunkSize = init.chunk_size;
    storage?.setItem(key, uploadId);
  }

  const plan = planChunks(file.size, chunkSize);
  const queue = pendingChunks(plan, received);
  let loaded = uploadedBytes(plan, received);
  let chunksDone = plan.length - queue.length;
  const startedAt = now();
  const startLoaded = loaded;
  const report = () =>
    onProgress?.({
      loaded,
      total: file.size,
      speed: (loaded - startLoaded) / Math.max(0.001, (now() - startedAt) / 1000),
      chunksDone,
      totalChunks: plan.length,
    });
  report();

  const id = uploadId;
  const worker = async () => {
    for (;;) {
      const chunk = queue.shift();
      if (!chunk) return;
      for (let attempt = 0; ; attempt++) {
        if (signal?.aborted) throw new DOMException('Subida cancelada', 'AbortError');
        try {
          await api.putChunk(id, chunk.index, file.slice(chunk.start, chunk.end), signal);
          break;
        } catch (err) {
          if (signal?.aborted || attempt >= retries) throw err;
          await sleep(retryDelayMs * 2 ** attempt);
        }
      }
      loaded += chunk.end - chunk.start;
      chunksDone++;
      report();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, worker),
  );

  const result = await api.completeUpload(id);
  storage?.removeItem(key);
  return result;
}
