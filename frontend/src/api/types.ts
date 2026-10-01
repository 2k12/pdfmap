// Tipos que reflejan el contrato docs/architecture/api-contract.md y template-model.md.

export type FieldType = 'text' | 'number' | 'integer' | 'date';
export type RuleAction = 'row' | 'context' | 'row_context' | 'append' | 'check' | 'skip';
export type MatchType = 'regex' | 'starts_with' | 'contains' | 'always';
export type MetaSource = '@page' | '@line' | '@rule' | '@raw';
export type ExportFormat = 'xlsx' | 'csv';

export interface Field {
  key: string;
  label?: string;
  start?: number | null;
  end?: number | null;
  group?: string | null;
  constant?: string | null;
  type: FieldType;
  decimal?: '.' | ',';
  date_formats?: string[];
  required?: boolean;
  default?: string | null;
  null_values?: string[];
  target?: string | null;
}

export interface CheckCompare {
  field: string;
  sum_of: string;
}

export interface RuleCheck {
  group: string;
  compare: CheckCompare[];
  tolerance?: string;
}

export interface Rule {
  id: string;
  name: string;
  color?: string;
  enabled?: boolean;
  action: RuleAction;
  match: { type: MatchType; value: string; ignore_case?: boolean };
  fields: Field[];
  clears?: string[];
  check?: RuleCheck | null;
}

export interface Column {
  id: string;
  header: string;
  sources: string[];
  enabled?: boolean;
  width?: number | null;
  number_format?: string | null;
  total?: boolean;
}

export interface TemplateOptions {
  sheet_name?: string;
  totals_row?: boolean;
  freeze_header?: boolean;
  autofilter?: boolean;
  header_color?: string;
  csv_delimiter?: string;
}

export interface Template {
  id?: string;
  name: string;
  description?: string;
  version?: number;
  builtin?: boolean;
  rules: Rule[];
  columns: Column[];
  options: TemplateOptions;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  builtin: boolean;
  updated_at?: string;
}

export type FileStatus = 'uploaded' | 'extracting' | 'ready' | 'error';

export interface FileOut {
  id: string;
  name: string;
  size: number;
  kind: 'pdf' | 'text';
  status: FileStatus;
  progress: number;
  pages: number | null;
  lines: number | null;
  error: string | null;
  created_at: string;
  extraction?: { char_width?: number; x_origin?: number; y_tolerance?: number } | null;
}

export interface UploadInit {
  upload_id: string;
  chunk_size: number;
  total_chunks: number;
}

export interface UploadStatus extends UploadInit {
  filename: string;
  size: number;
  received: number[];
}

export interface PageLine {
  n: number;
  text: string;
}

export interface PageOut {
  page: number;
  pages: number;
  lines: PageLine[];
}

export interface SearchMatch {
  page: number;
  n: number;
  text: string;
}

export interface SearchOut {
  matches: SearchMatch[];
  truncated: boolean;
}

export interface Segment {
  start: number;
  end: number | null;
  type: FieldType;
  date_formats?: string[];
  decimal?: '.' | ',';
}

export interface Issue {
  page: number;
  line: number;
  rule: string;
  message: string;
}

export interface Stats {
  lines: number;
  rows: number;
  unmatched: number;
  rule_hits: Record<string, number>;
  error_count: number;
  errors: Issue[];
  checks_ok: number;
  checks_failed_count: number;
  checks_failed: Issue[];
}

export type CellValue = string | number | null;

export interface AnnotatedLine {
  n: number;
  text: string;
  rule: string | null;
  values: Record<string, CellValue>;
  errors: string[];
}

export interface AnnotateOut {
  page: number;
  lines: AnnotatedLine[];
}

export interface PreviewColumn {
  id: string;
  header: string;
  type: FieldType;
}

export interface PreviewOut {
  columns: PreviewColumn[];
  rows: CellValue[][];
  stats: Stats;
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface JobOut {
  id: string;
  kind: 'export' | 'extract';
  file_id: string;
  template_id: string | null;
  status: JobStatus;
  progress: number;
  message: string;
  stats: Stats | null;
  formats: ExportFormat[];
  rows: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface JobRowsOut {
  columns: PreviewColumn[];
  rows: CellValue[][];
  total: number;
}

export interface ValidateOut {
  valid: boolean;
  errors: string[];
}
