/** Convierte un texto en un identificador válido para el contrato: ^[a-z][a-z0-9_]{0,39}$ */
export function slugify(text: string): string {
  let slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!slug) slug = 'campo';
  if (!/^[a-z]/.test(slug)) slug = `c_${slug}`;
  return slug.slice(0, 40).replace(/_+$/, '');
}

/** Devuelve `base` o `base_2`, `base_3`... para que no colisione con `existing`. */
export function uniqueId(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const root = slugify(base);
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) {
    const suffix = `_${i}`;
    const candidate = `${root.slice(0, 40 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export const ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
