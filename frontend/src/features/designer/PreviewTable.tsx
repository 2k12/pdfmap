import type { CellValue, PreviewColumn, Stats } from '../../api/types';
import { formatCell } from '../../lib/format';

export function PreviewTable({
  columns,
  rows,
  headerColor = '1F4E78',
  testId = 'preview-table',
  caption,
  startIndex = 0,
}: {
  columns: PreviewColumn[];
  rows: CellValue[][];
  headerColor?: string;
  testId?: string;
  caption?: string;
  startIndex?: number;
}) {
  const bg = `#${headerColor.replace('#', '')}`;
  return (
    <div className="sheet" tabIndex={0} role="region" aria-label={caption ?? 'Vista previa'}>
      <table className="sheet__table" data-testid={testId}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" className="sheet__rownum">
              #
            </th>
            {columns.map((c) => (
              <th scope="col" key={c.id} style={{ background: bg }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="sheet__rownum">{startIndex + i + 1}</td>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={
                    columns[j]?.type === 'number' || columns[j]?.type === 'integer'
                      ? 'num'
                      : undefined
                  }
                >
                  {formatCell(v, columns[j]?.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty small">Sin filas.</p>}
    </div>
  );
}

export function StatsPanel({ stats }: { stats: Stats }) {
  return (
    <div className="stats" aria-label="Estadísticas">
      <dl className="stats__grid">
        <div>
          <dt>Líneas leídas</dt>
          <dd>{stats.lines.toLocaleString('es')}</dd>
        </div>
        <div>
          <dt>Filas</dt>
          <dd>{stats.rows.toLocaleString('es')}</dd>
        </div>
        <div>
          <dt>Sin regla</dt>
          <dd>{stats.unmatched.toLocaleString('es')}</dd>
        </div>
        <div>
          <dt>Errores de conversión</dt>
          <dd className={stats.error_count ? 'text-error' : undefined}>{stats.error_count}</dd>
        </div>
        <div>
          <dt>Cuadres OK</dt>
          <dd className="text-ok">{stats.checks_ok}</dd>
        </div>
        <div>
          <dt>Descuadres</dt>
          <dd className={stats.checks_failed_count ? 'text-error' : undefined}>
            {stats.checks_failed_count}
          </dd>
        </div>
      </dl>
      {Object.keys(stats.rule_hits).length > 0 && (
        <p className="small muted">
          Coincidencias:{' '}
          {Object.entries(stats.rule_hits)
            .map(([r, n]) => `${r}: ${n}`)
            .join(' · ')}
        </p>
      )}
      {stats.errors.length > 0 && (
        <details>
          <summary>Errores ({stats.error_count})</summary>
          <ul className="small">
            {stats.errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                p.{e.page} l.{e.line} [{e.rule}] {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {stats.checks_failed.length > 0 && (
        <details open>
          <summary>Descuadres ({stats.checks_failed_count})</summary>
          <ul className="small">
            {stats.checks_failed.slice(0, 50).map((e, i) => (
              <li key={i}>
                p.{e.page} l.{e.line} [{e.rule}] {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
