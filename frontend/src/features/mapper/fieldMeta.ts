import type { Field, FieldType } from '../../api/types';

export const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  number: 'Número',
  integer: 'Entero',
  date: 'Fecha',
};

export const COMMON_DATE_FORMATS = [
  '%d/%m/%Y',
  '%d/%m/%y',
  '%Y-%m-%d',
  '%y/%m/%d',
  '%Y/%m/%d',
  '%d-%m-%Y',
  '%m/%d/%Y',
  '%d.%m.%Y',
];

export type Source = 'position' | 'group' | 'constant';

export function fieldSource(f: Field): Source {
  if (f.constant !== undefined && f.constant !== null) return 'constant';
  if (f.group) return 'group';
  return 'position';
}
