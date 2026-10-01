/** Regla de columnas: marca cada 10 posiciones con su número. */
export function rulerText(width: number): string {
  let out = '';
  for (let i = 0; i < width; i++) {
    if (i % 10 === 0) {
      const label = String(i);
      out += label;
      i += label.length - 1;
    } else out += i % 5 === 0 ? '+' : '·';
  }
  return out.slice(0, width);
}
