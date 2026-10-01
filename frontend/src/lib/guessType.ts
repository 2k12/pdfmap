import type { Field } from '../api/types';

export function guessType(sample: string): Field['type'] {
  const s = sample.trim();
  if (!s) return 'text';
  if (/^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(s)) return 'date';
  if (/^-?\d{1,5}$/.test(s)) return 'integer';
  if (/^[-(]?\$?\s*[\d.,]*\d[\d.,]*[-)]?$/.test(s) && /[.,]/.test(s)) return 'number';
  return 'text';
}
