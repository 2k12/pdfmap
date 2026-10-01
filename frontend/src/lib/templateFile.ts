import type { Template } from '../api/types';

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, '_') || 'plantilla'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lee y valida un JSON de plantilla. Lanza Error con un mensaje legible. */
export async function parseTemplateFile(file: Blob): Promise<Template> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const t = data as Template;
  if (!t || typeof t !== 'object' || !Array.isArray(t.rules) || !Array.isArray(t.columns))
    throw new Error('El JSON no tiene la forma de una plantilla (faltan "rules" o "columns").');
  return { ...t, options: t.options ?? {} };
}
