import type {
  AnnotateOut,
  ExportFormat,
  FileOut,
  JobOut,
  JobRowsOut,
  PageOut,
  PreviewOut,
  SearchOut,
  Segment,
  Template,
  TemplateSummary,
  UploadInit,
  UploadStatus,
  ValidateOut,
} from './types';

// URL absoluta: funciona en el navegador y en jsdom (tests) con fetch nativo.
export const API_BASE = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let apiKey: string | null = null;
export function setApiKey(key: string | null) {
  apiKey = key;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (apiKey) h['X-API-Key'] = apiKey;
  return h;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') message = body.detail;
    else if (Array.isArray(body?.detail))
      message = body.detail.map((d: { msg?: string }) => d.msg ?? '').join('; ');
  } catch {
    /* cuerpo no JSON */
  }
  return new ApiError(res.status, message);
}

export async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: headers(json !== undefined ? { 'Content-Type': 'application/json' } : undefined),
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),

  // Subidas por fragmentos
  initUpload: (filename: string, size: number) =>
    request<UploadInit>('/uploads', { method: 'POST', json: { filename, size } }),
  uploadStatus: (uploadId: string) => request<UploadStatus>(`/uploads/${uploadId}`),
  putChunk: async (uploadId: string, index: number, blob: Blob, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE}/uploads/${uploadId}/chunks/${index}`, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/octet-stream' }),
      body: blob,
      signal,
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as { received: number; total_chunks: number };
  },
  completeUpload: (uploadId: string) =>
    request<FileOut>(`/uploads/${uploadId}/complete`, { method: 'POST' }),
  abortUpload: (uploadId: string) => request<void>(`/uploads/${uploadId}`, { method: 'DELETE' }),

  // Archivos
  listFiles: () => request<FileOut[]>('/files'),
  getFile: (id: string) => request<FileOut>(`/files/${id}`),
  deleteFile: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  reextract: (
    id: string,
    params: { char_width?: number; x_origin?: number; y_tolerance?: number },
  ) => request<FileOut>(`/files/${id}/extract`, { method: 'POST', json: params }),
  getPage: (id: string, page: number) => request<PageOut>(`/files/${id}/pages/${page}`),
  search: (id: string, pattern: string, mode: 'regex' | 'contains' = 'contains', limit = 50) =>
    request<SearchOut>(
      `/files/${id}/search?${new URLSearchParams({ pattern, mode, limit: String(limit) })}`,
    ),

  // Asistentes de mapeo
  suggestRegex: (line: string, tokens = 1) =>
    request<{ regex: string }>('/mapping/suggest-regex', {
      method: 'POST',
      json: { line, tokens },
    }),
  suggestColumns: (lines: string[], min_gap = 1) =>
    request<{ segments: Segment[] }>('/mapping/suggest-columns', {
      method: 'POST',
      json: { lines, min_gap },
    }),
  validateTemplate: (template: Template) =>
    request<ValidateOut>('/mapping/validate', { method: 'POST', json: { template } }),
  annotate: (file_id: string, template: Template, page: number, signal?: AbortSignal) =>
    request<AnnotateOut>('/mapping/annotate', {
      method: 'POST',
      json: { file_id, template, page },
      signal,
    }),
  preview: (
    file_id: string,
    template: Template,
    max_pages = 20,
    limit = 200,
    signal?: AbortSignal,
  ) =>
    request<PreviewOut>('/mapping/preview', {
      method: 'POST',
      json: { file_id, template, max_pages, limit },
      signal,
    }),

  // Plantillas
  listTemplates: () => request<TemplateSummary[]>('/templates'),
  getTemplate: (id: string) => request<Template>(`/templates/${id}`),
  createTemplate: (t: Template) => request<Template>('/templates', { method: 'POST', json: t }),
  updateTemplate: (id: string, t: Template) =>
    request<Template>(`/templates/${id}`, { method: 'PUT', json: t }),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),

  // Trabajos
  createJob: (body: {
    file_id: string;
    template_id?: string;
    template?: Template;
    formats: ExportFormat[];
  }) => request<JobOut>('/jobs', { method: 'POST', json: body }),
  listJobs: (file_id?: string) =>
    request<JobOut[]>(`/jobs${file_id ? `?file_id=${encodeURIComponent(file_id)}` : ''}`),
  getJob: (id: string) => request<JobOut>(`/jobs/${id}`),
  jobRows: (id: string, offset = 0, limit = 100) =>
    request<JobRowsOut>(`/jobs/${id}/rows?offset=${offset}&limit=${limit}`),
  cancelJob: (id: string) => request<JobOut>(`/jobs/${id}/cancel`, { method: 'POST' }),
  downloadUrl: (id: string, format: ExportFormat) =>
    `${API_BASE}/jobs/${id}/download?format=${format}`,
};
