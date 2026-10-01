import { http, HttpResponse } from 'msw';
import type {
  AnnotatedLine,
  FileOut,
  JobOut,
  Template,
  TemplateSummary,
} from '../../src/api/types';
import { matchesLocally, pythonToJsRegex } from '../../src/lib/regex';
import { BUILTIN_EXAMPLE, READY_FILE, SALES_TEMPLATE, SAMPLE_LINES } from '../fixtures/data';

const API = '*/api/v1';

/** "Base de datos" en memoria del backend simulado; se reinicia en cada test. */
export const db = {
  files: [] as FileOut[],
  templates: [] as Template[],
  jobs: [] as JobOut[],
  uploads: new Map<
    string,
    { filename: string; size: number; received: Set<number>; failOnce: Set<number> }
  >(),
  chunkSize: 4,
  jobPolls: 0,
  calls: [] as string[],
};

export function resetDb() {
  db.files = [structuredClone(READY_FILE)];
  db.templates = [structuredClone(BUILTIN_EXAMPLE), structuredClone(SALES_TEMPLATE)];
  db.jobs = [];
  db.uploads = new Map();
  db.chunkSize = 4;
  db.jobPolls = 0;
  db.calls = [];
}
resetDb();

function evalLine(t: Template, text: string, n: number): AnnotatedLine {
  for (const r of t.rules) {
    if (r.enabled === false || (!r.match.value && r.match.type !== 'always')) continue;
    if (!matchesLocally(r.match, text)) continue;
    const values: Record<string, string | number | null> = {};
    let groups: Record<string, string> = {};
    if (r.match.type === 'regex') {
      groups = new RegExp(pythonToJsRegex(r.match.value)).exec(text)?.groups ?? {};
    }
    for (const f of r.fields) {
      if (f.constant != null) values[f.key] = f.constant;
      else if (f.group) values[f.key] = groups[f.group] ?? null;
      else
        values[f.key] =
          (f.end == null ? text.slice(f.start ?? 0) : text.slice(f.start ?? 0, f.end)).trim() ||
          null;
    }
    return { n, text, rule: r.id, values, errors: [] };
  }
  return { n, text, rule: null, values: {}, errors: [] };
}

function stats(rows: number) {
  return {
    lines: SAMPLE_LINES.length,
    rows,
    unmatched: 2,
    rule_hits: { venta: rows },
    error_count: 0,
    errors: [],
    checks_ok: 2,
    checks_failed_count: 0,
    checks_failed: [],
  };
}

function previewRows(t: Template) {
  const columns = t.columns
    .filter((c) => c.enabled !== false)
    .map((c) => ({
      id: c.id,
      header: c.header,
      type: c.id === 'total' ? ('number' as const) : ('text' as const),
    }));
  const rows = [1, 2, 3].map((i) =>
    columns.map((c) => (c.type === 'number' ? i * 100.5 : `${c.header} ${i}`)),
  );
  return { columns, rows };
}

export const handlers = [
  http.get(`${API}/health`, () => HttpResponse.json({ status: 'ok', version: '1.0.0' })),

  // Subidas
  http.post(`${API}/uploads`, async ({ request }) => {
    const body = (await request.json()) as { filename: string; size: number };
    const id = `up-${db.uploads.size + 1}`;
    db.uploads.set(id, { ...body, received: new Set(), failOnce: new Set() });
    return HttpResponse.json({
      upload_id: id,
      chunk_size: db.chunkSize,
      total_chunks: Math.max(1, Math.ceil(body.size / db.chunkSize)),
    });
  }),
  http.get(`${API}/uploads/:id`, ({ params }) => {
    const up = db.uploads.get(String(params.id));
    if (!up) return HttpResponse.json({ detail: 'Subida no encontrada' }, { status: 404 });
    return HttpResponse.json({
      upload_id: params.id,
      filename: up.filename,
      size: up.size,
      chunk_size: db.chunkSize,
      total_chunks: Math.ceil(up.size / db.chunkSize),
      received: [...up.received],
    });
  }),
  http.put(`${API}/uploads/:id/chunks/:index`, ({ params }) => {
    const up = db.uploads.get(String(params.id));
    if (!up) return HttpResponse.json({ detail: 'Subida no encontrada' }, { status: 404 });
    const index = Number(params.index);
    db.calls.push(`chunk:${index}`);
    if (up.failOnce.has(index)) {
      up.failOnce.delete(index);
      return HttpResponse.json({ detail: 'Error transitorio' }, { status: 503 });
    }
    up.received.add(index);
    return HttpResponse.json({
      received: up.received.size,
      total_chunks: Math.ceil(up.size / db.chunkSize),
    });
  }),
  http.post(`${API}/uploads/:id/complete`, ({ params }) => {
    const up = db.uploads.get(String(params.id));
    if (!up) return HttpResponse.json({ detail: 'Subida no encontrada' }, { status: 404 });
    const file: FileOut = {
      ...READY_FILE,
      id: `file-${db.files.length + 1}`,
      name: up.filename,
      size: up.size,
      status: 'extracting',
      progress: 0.1,
      pages: null,
      lines: null,
    };
    db.files.unshift(file);
    return HttpResponse.json(file);
  }),
  http.delete(`${API}/uploads/:id`, () => new HttpResponse(null, { status: 204 })),

  // Archivos
  http.get(`${API}/files`, () => HttpResponse.json(db.files)),
  http.get(`${API}/files/:id`, ({ params }) => {
    const f = db.files.find((x) => x.id === params.id);
    return f
      ? HttpResponse.json(f)
      : HttpResponse.json({ detail: 'No encontrado' }, { status: 404 });
  }),
  http.delete(`${API}/files/:id`, ({ params }) => {
    db.files = db.files.filter((f) => f.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/files/:id/pages/:page`, ({ params }) => {
    const page = Number(params.page);
    return HttpResponse.json({
      page,
      pages: 3,
      lines: SAMPLE_LINES.map((text, i) => ({
        n: i + 1,
        text: page === 1 ? text : `${text}`.replace('Pag. 1', `Pag. ${page}`),
      })),
    });
  }),
  http.get(`${API}/files/:id/search`, ({ request }) => {
    const pattern = new URL(request.url).searchParams.get('pattern') ?? '';
    const matches = SAMPLE_LINES.map((text, i) => ({ page: 2, n: i + 1, text })).filter((m) =>
      m.text.includes(pattern),
    );
    return HttpResponse.json({ matches, truncated: false });
  }),

  // Asistentes
  http.post(`${API}/mapping/suggest-regex`, async ({ request }) => {
    const { line } = (await request.json()) as { line: string };
    const regex = line.startsWith('Vendedor:')
      ? '^Vendedor:'
      : /^\d{2}\//.test(line)
        ? '^\\d{2}/\\d{2}/\\d{4}'
        : '^X';
    return HttpResponse.json({ regex });
  }),
  http.post(`${API}/mapping/suggest-columns`, () =>
    HttpResponse.json({
      segments: [
        { start: 0, end: 10, type: 'date', date_formats: ['%d/%m/%Y'] },
        { start: 12, end: 20, type: 'text' },
        { start: 56, end: null, type: 'number', decimal: '.' },
      ],
    }),
  ),
  http.post(`${API}/mapping/validate`, async ({ request }) => {
    const { template } = (await request.json()) as { template: Template };
    const errors = template.rules.some((r) => !r.id) ? ['Regla sin id'] : [];
    return HttpResponse.json({ valid: errors.length === 0, errors });
  }),
  http.post(`${API}/mapping/annotate`, async ({ request }) => {
    const { template, page } = (await request.json()) as { template: Template; page: number };
    return HttpResponse.json({
      page,
      lines: SAMPLE_LINES.map((t, i) => evalLine(template, t, i + 1)),
    });
  }),
  http.post(`${API}/mapping/preview`, async ({ request }) => {
    const { template } = (await request.json()) as { template: Template };
    return HttpResponse.json({ ...previewRows(template), stats: stats(3) });
  }),

  // Plantillas
  http.get(`${API}/templates`, () =>
    HttpResponse.json(
      db.templates.map<TemplateSummary>((t) => ({
        id: t.id!,
        name: t.name,
        description: t.description,
        builtin: !!t.builtin,
        updated_at: '2026-10-01T10:00:00Z',
      })),
    ),
  ),
  http.get(`${API}/templates/:id`, ({ params }) => {
    const t = db.templates.find((x) => x.id === params.id);
    return t
      ? HttpResponse.json(t)
      : HttpResponse.json({ detail: 'No encontrada' }, { status: 404 });
  }),
  http.post(`${API}/templates`, async ({ request }) => {
    const t = (await request.json()) as Template;
    const saved = { ...t, id: `tpl-${db.templates.length + 1}`, builtin: false };
    db.templates.push(saved);
    return HttpResponse.json(saved, { status: 201 });
  }),
  http.put(`${API}/templates/:id`, async ({ params, request }) => {
    const t = (await request.json()) as Template;
    const i = db.templates.findIndex((x) => x.id === params.id);
    if (i < 0) return HttpResponse.json({ detail: 'No encontrada' }, { status: 404 });
    if (db.templates[i].builtin)
      return HttpResponse.json({ detail: 'Plantilla de solo lectura' }, { status: 403 });
    db.templates[i] = { ...t, id: String(params.id) };
    return HttpResponse.json(db.templates[i]);
  }),
  http.delete(`${API}/templates/:id`, ({ params }) => {
    db.templates = db.templates.filter((t) => t.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Trabajos
  http.get(`${API}/jobs`, ({ request }) => {
    const fileId = new URL(request.url).searchParams.get('file_id');
    return HttpResponse.json(db.jobs.filter((j) => !fileId || j.file_id === fileId));
  }),
  http.post(`${API}/jobs`, async ({ request }) => {
    const body = (await request.json()) as { file_id: string; formats: JobOut['formats'] };
    const job: JobOut = {
      id: `job-${db.jobs.length + 1}-abcdef`,
      kind: 'export',
      file_id: body.file_id,
      template_id: null,
      status: 'running',
      progress: 0.3,
      message: 'Procesando página 1 de 3',
      stats: null,
      formats: body.formats,
      rows: null,
      created_at: '2026-10-01T10:00:00Z',
      finished_at: null,
    };
    db.jobs.push(job);
    db.jobPolls = 0;
    return HttpResponse.json(job, { status: 202 });
  }),
  http.get(`${API}/jobs/:id`, ({ params }) => {
    const job = db.jobs.find((j) => j.id === params.id);
    if (!job) return HttpResponse.json({ detail: 'No encontrado' }, { status: 404 });
    db.jobPolls++;
    if (job.status === 'running' && db.jobPolls >= 1) {
      Object.assign(job, {
        status: 'done',
        progress: 1,
        message: 'Terminado',
        rows: 250,
        stats: stats(250),
        finished_at: '2026-10-01T10:01:00Z',
      });
    }
    return HttpResponse.json(job);
  }),
  http.post(`${API}/jobs/:id/cancel`, ({ params }) => {
    const job = db.jobs.find((j) => j.id === params.id);
    if (!job) return HttpResponse.json({ detail: 'No encontrado' }, { status: 404 });
    Object.assign(job, { status: 'cancelled', message: 'Cancelado por el usuario' });
    return HttpResponse.json(job);
  }),
  http.get(`${API}/jobs/:id/rows`, ({ request }) => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const total = 250;
    const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => [
      `Fila ${offset + i + 1}`,
      (offset + i) * 1.5,
    ]);
    return HttpResponse.json({
      columns: [
        { id: 'cliente', header: 'Cliente', type: 'text' },
        { id: 'total', header: 'Total', type: 'number' },
      ],
      rows,
      total,
    });
  }),
];
