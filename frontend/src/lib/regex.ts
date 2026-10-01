/** Convierte la sintaxis de Python (backend) a la de JavaScript para validar/previsualizar. */
export function pythonToJsRegex(pattern: string): string {
  return pattern
    .replace(/\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?<$1>')
    .replace(/\(\?P=(\w+)\)/g, '\\k<$1>');
}

/** Devuelve un mensaje de error si el patrón no es válido, o null. */
export function validateRegex(pattern: string): string | null {
  if (!pattern) return 'El patrón está vacío';
  if (pattern.length > 500) return 'El patrón supera los 500 caracteres';
  try {
    new RegExp(pythonToJsRegex(pattern));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Patrón inválido';
  }
}

/** Grupos con nombre del patrón (para ofrecer campos por grupo). */
export function namedGroups(pattern: string): string[] {
  const out: string[] = [];
  const re = /\(\?P?<([A-Za-z_][A-Za-z0-9_]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern))) out.push(m[1]);
  return out;
}

/** Evaluación local de un match (vista previa instantánea). */
export function matchesLocally(
  match: { type: string; value: string; ignore_case?: boolean },
  line: string,
): boolean {
  const ic = !!match.ignore_case;
  const text = ic ? line.toLowerCase() : line;
  const value = ic ? match.value.toLowerCase() : match.value;
  switch (match.type) {
    case 'regex':
      try {
        return new RegExp(pythonToJsRegex(match.value), ic ? 'i' : '').test(line);
      } catch {
        return false;
      }
    case 'starts_with':
      return text.trimStart().startsWith(value);
    case 'contains':
      return text.includes(value);
    case 'always':
      return line.trim().length > 0;
    default:
      return false;
  }
}
