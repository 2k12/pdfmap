import type { ReactNode } from 'react';
import type { FileStatus, JobStatus } from '../api/types';
import { formatPercent } from '../lib/format';

export function ProgressBar({
  value,
  label,
  testId,
}: {
  value: number;
  label: string;
  testId?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div className="progress" data-testid={testId}>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress__text">{formatPercent(value)}</span>
    </div>
  );
}

const STATUS_LABELS: Record<FileStatus | JobStatus, string> = {
  uploaded: 'Subido',
  extracting: 'Extrayendo',
  ready: 'Listo',
  error: 'Error',
  queued: 'En cola',
  running: 'Procesando',
  done: 'Terminado',
  cancelled: 'Cancelado',
};

export function StatusBadge({ status }: { status: FileStatus | JobStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className ?? ''}`} aria-label={title}>
      <header className="panel__header">
        <h2>{title}</h2>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
