import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api, ApiError, setApiKey } from '../../src/api/client';
import { resumeKey, uploadFile, validateFile } from '../../src/features/upload/uploader';
import { db } from '../mocks/handlers';
import { server } from '../mocks/server';

const makeFile = (content = 'abcdefghij', name = 'reporte.pdf') =>
  new File([content], name, { type: 'application/pdf', lastModified: 1 });

describe('validateFile', () => {
  it('[RF-03] rechaza extensiones no soportadas', () => {
    expect(validateFile({ name: 'foto.png', size: 10 })).toMatch(/no soportado/);
    expect(validateFile({ name: 'sinextension', size: 10 })).toMatch(/no soportado/);
  });
  it('[RF-03] rechaza archivos vacíos o demasiado grandes', () => {
    expect(validateFile({ name: 'a.pdf', size: 0 })).toMatch(/vacío/);
    expect(validateFile({ name: 'a.pdf', size: 11 }, 10)).toMatch(/tamaño/);
  });
  it('[RF-03] acepta PDF, TXT y PRN sin importar mayúsculas', () => {
    for (const name of ['a.pdf', 'b.TXT', 'c.prn', 'd.PDF'])
      expect(validateFile({ name, size: 1 })).toBeNull();
  });
});

describe('uploadFile (subida por fragmentos)', () => {
  it('[RF-02] sube todos los fragmentos y completa la subida', async () => {
    const progress: number[] = [];
    const result = await uploadFile(makeFile(), { onProgress: (p) => progress.push(p.loaded) });
    expect(result.name).toBe('reporte.pdf');
    expect(result.status).toBe('extracting');
    expect(db.calls.filter((c) => c.startsWith('chunk:')).sort()).toEqual([
      'chunk:0',
      'chunk:1',
      'chunk:2',
    ]);
    expect(progress.at(-1)).toBe(10);
    expect(localStorage.getItem(resumeKey(makeFile()))).toBeNull();
  });

  it('[RF-02] reintenta un fragmento que falla transitoriamente', async () => {
    server.use(
      http.post('*/api/v1/uploads', async ({ request }) => {
        const body = (await request.json()) as { filename: string; size: number };
        db.uploads.set('up-x', { ...body, received: new Set(), failOnce: new Set([1]) });
        return HttpResponse.json({ upload_id: 'up-x', chunk_size: 4, total_chunks: 3 });
      }),
    );
    const result = await uploadFile(makeFile(), { retryDelayMs: 1 });
    expect(result.name).toBe('reporte.pdf');
    expect(db.calls.filter((c) => c === 'chunk:1')).toHaveLength(2);
  });

  it('[RF-02] reanuda una subida interrumpida enviando solo los fragmentos faltantes', async () => {
    const file = makeFile();
    db.uploads.set('up-prev', {
      filename: file.name,
      size: file.size,
      received: new Set([0, 1]),
      failOnce: new Set(),
    });
    localStorage.setItem(resumeKey(file), 'up-prev');
    await uploadFile(file);
    expect(db.calls).toEqual(['chunk:2']);
  });

  it('[RF-02] si el upload_id guardado caducó en el servidor, inicia una subida nueva', async () => {
    const file = makeFile();
    localStorage.setItem(resumeKey(file), 'up-desaparecido');
    const result = await uploadFile(file);
    expect(result.name).toBe(file.name);
    expect(db.calls).toHaveLength(3);
  });

  it('[RF-02] falla tras agotar los reintentos y conserva el id para reanudar', async () => {
    server.use(
      http.put('*/api/v1/uploads/:id/chunks/:index', () =>
        HttpResponse.json({ detail: 'caído' }, { status: 500 }),
      ),
    );
    const file = makeFile();
    await expect(uploadFile(file, { retries: 1, retryDelayMs: 1 })).rejects.toThrow('caído');
    expect(localStorage.getItem(resumeKey(file))).toBeTruthy();
  });

  it('[RF-02] permite cancelar la subida', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(uploadFile(makeFile(), { signal: controller.signal })).rejects.toThrow();
  });
});

describe('cliente API', () => {
  it('[RNF-03] convierte errores en ApiError con el detalle del backend', async () => {
    server.use(
      http.get('*/api/v1/files/:id', () =>
        HttpResponse.json({ detail: 'No encontrado' }, { status: 404 }),
      ),
    );
    const err = await api.getFile('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('No encontrado');
  });
  it('[RNF-03] aplana errores de validación 422 y tolera cuerpos no JSON', async () => {
    server.use(
      http.get('*/api/v1/files', () =>
        HttpResponse.json({ detail: [{ msg: 'a' }, { msg: 'b' }] }, { status: 422 }),
      ),
      http.get('*/api/v1/health', () => new HttpResponse('boom', { status: 500 })),
    );
    await expect(api.listFiles()).rejects.toThrow('a; b');
    await expect(api.health()).rejects.toThrow('Error 500');
  });
  it('[RNF-03] envía la cabecera X-API-Key cuando está configurada', async () => {
    let seen: string | null = null;
    server.use(
      http.get('*/api/v1/health', ({ request }) => {
        seen = request.headers.get('X-API-Key');
        return HttpResponse.json({ status: 'ok', version: '1' });
      }),
    );
    setApiKey('secreta');
    await api.health();
    setApiKey(null);
    expect(seen).toBe('secreta');
  });
  it('[RF-15] construye URLs de descarga por formato', () => {
    expect(api.downloadUrl('j1', 'csv')).toMatch(/\/api\/v1\/jobs\/j1\/download\?format=csv$/);
  });
  it('[RF-04] expone re-extracción, plantillas y trabajos', async () => {
    server.use(
      http.post('*/api/v1/files/:id/extract', () =>
        HttpResponse.json({ id: 'file-1', status: 'extracting' }),
      ),
    );
    expect((await api.reextract('file-1', { char_width: 5 })).status).toBe('extracting');
    expect(await api.listJobs('file-1')).toEqual([]);
    await api.abortUpload('up-1');
    const saved = await api.createTemplate({ name: 'n', rules: [], columns: [], options: {} });
    expect((await api.updateTemplate(saved.id!, { ...saved, name: 'm' })).name).toBe('m');
  });
});
