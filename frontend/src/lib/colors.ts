export const RULE_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
  '#dc2626',
  '#0d9488',
];

export function nextColor(used: Array<string | undefined>): string {
  const taken = new Set(used.filter(Boolean));
  return RULE_PALETTE.find((c) => !taken.has(c)) ?? RULE_PALETTE[used.length % RULE_PALETTE.length];
}

/** Color con transparencia (hex #rrggbb + alfa 0-1) para fondos. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
