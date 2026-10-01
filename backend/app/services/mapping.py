"""Aplicación de plantillas: anotación por línea, vista previa y exportación completa."""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from ..config import Settings
from ..core.export import CsvExporter, ExcelExporter
from ..core.extraction import Line
from ..core.mapping import MappingEngine, column_types
from ..db import Database
from .errors import Conflict, NotFound, ServiceError
from .files import FileService
from .jobs import JobContext, JobManager
from .security import valid_uuid
from .templates import TemplateService

ROW_BATCH = 1000
EXTENSIONS = {"xlsx": "xlsx", "csv": "csv"}


def to_json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d") if not (value.hour or value.minute or value.second) else value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def columns_out(template: dict) -> list[dict]:
    types = column_types(template)
    return [
        {"id": c["id"], "header": c["header"], "type": types[c["id"]]}
        for c in template.get("columns", [])
        if c.get("enabled", True)
    ]


class MappingService:
    def __init__(
        self, settings: Settings, db: Database, files: FileService, templates: TemplateService, jobs: JobManager
    ) -> None:
        self.settings = settings
        self.db = db
        self.files = files
        self.templates = templates
        self.jobs = jobs

    def annotate(self, file_id: str, template: dict, page: int) -> dict[str, Any]:
        data = self.files.page(file_id, page)
        engine = MappingEngine(template)
        out = []
        for line, result in engine.annotate(Line(page, ln["n"], ln["text"]) for ln in data["lines"]):
            out.append(
                {
                    "n": line.n,
                    "text": line.text,
                    "rule": result.rule,
                    "values": {k: to_json_value(v) for k, v in result.values.items()},
                    "errors": result.errors,
                }
            )
        return {"page": page, "pages": data["pages"], "lines": out}

    def preview(self, file_id: str, template: dict, start_page: int, max_pages: int, limit: int) -> dict[str, Any]:
        max_pages = min(max_pages, self.settings.preview_max_pages)
        engine = MappingEngine(template)
        rows: list[list] = []
        lines = self.files.iter_lines(file_id, start_page, start_page + max_pages - 1)
        for row in engine.process(lines):
            if len(rows) < limit:
                rows.append([to_json_value(v) for v in row])
        return {"columns": columns_out(template), "rows": rows, "stats": engine.finish_stats()}

    # -- Trabajos de exportación ------------------------------------------------------------
    def start_export(
        self, file_id: str, template_id: str | None, template: dict | None, formats: list[str]
    ) -> dict[str, Any]:
        info = self.files.require_ready(file_id)
        if template is None:
            template = self.templates.get(template_id)  # type: ignore[arg-type]
        if not template.get("columns"):
            raise ServiceError("La plantilla no tiene columnas definidas", 422)
        formats = sorted(set(formats))
        job_id = self.jobs.create("export", file_id, template_id, template, formats)
        self.jobs.update(job_id, columns=columns_out(template))
        out_dir = self.settings.outputs_dir / job_id
        total_lines = info["lines"] or 1

        def work(ctx: JobContext) -> dict:
            return self._export(ctx, job_id, file_id, template, formats, out_dir, total_lines)

        self.jobs.submit(job_id, work)
        return self.jobs.get(job_id)

    def _export(
        self,
        ctx: JobContext,
        job_id: str,
        file_id: str,
        template: dict,
        formats: list[str],
        out_dir: Path,
        total_lines: int,
    ) -> dict:
        engine = MappingEngine(template)
        options = template.get("options", {})
        writers: list[Any] = []
        if "xlsx" in formats:
            writers.append(ExcelExporter(out_dir / "resultado.xlsx", engine.columns, options, column_types(template)))
        if "csv" in formats:
            writers.append(CsvExporter(out_dir / "resultado.csv", engine.columns, options.get("csv_delimiter", ";")))
        batch: list[tuple] = []
        n_rows = 0
        try:
            for row in engine.process(self._counted(ctx, file_id, total_lines, engine)):
                for writer in writers:
                    writer.write(row)
                if n_rows < self.settings.max_stored_rows:
                    batch.append((job_id, n_rows, json.dumps([to_json_value(v) for v in row], ensure_ascii=False)))
                n_rows += 1
                if len(batch) >= ROW_BATCH:
                    self._store_rows(batch)
                    batch = []
            self._store_rows(batch)
            ctx.progress(0.99, "Guardando archivos…", force=True)
            for writer in writers:
                writer.close()
        except BaseException:
            for writer in writers:  # cerrar y descartar la salida parcial (cancelación o error)
                try:
                    writer.close()
                except Exception:  # noqa: BLE001, S110
                    pass
            shutil.rmtree(out_dir, ignore_errors=True)
            raise
        stats = engine.finish_stats()
        msg = f"{n_rows} filas generadas"
        if stats["checks_failed_count"]:
            msg += f"; {stats['checks_failed_count']} controles de cuadre fallidos"
        return {"rows": n_rows, "stats": stats, "message": msg}

    def _counted(self, ctx: JobContext, file_id: str, total: int, engine: MappingEngine):
        for i, line in enumerate(self.files.iter_lines(file_id), start=1):
            if i % 500 == 0:
                ctx.raise_if_cancelled()
                ctx.progress(min(i / total, 0.98), f"Línea {i} de {total} · {engine.stats.rows} filas")
            yield line

    def _store_rows(self, batch: list[tuple]) -> None:
        if batch:
            with self.db.connect() as conn:
                conn.executemany("INSERT INTO job_rows (job_id, idx, data) VALUES (?,?,?)", batch)

    def job_rows(self, job_id: str, offset: int, limit: int) -> dict[str, Any]:
        job = self.get_job(job_id)
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT data FROM job_rows WHERE job_id=? AND idx>=? ORDER BY idx LIMIT ?",
                (job_id, offset, limit),
            ).fetchall()
        return {
            "columns": json.loads(job["columns"] or "[]"),
            "rows": [json.loads(r["data"]) for r in rows],
            "total": min(job["rows"], self.settings.max_stored_rows),
        }

    def get_job(self, job_id: str) -> dict[str, Any]:
        valid_uuid(job_id, "trabajo")
        return self.jobs.get(job_id)

    def output_path(self, job_id: str, fmt: str) -> Path:
        job = self.get_job(job_id)
        if fmt not in EXTENSIONS:
            raise ServiceError("Formato no soportado", 400)
        if job["status"] != "done":
            raise Conflict(f"El trabajo no ha terminado (estado: {job['status']})")
        if fmt not in json.loads(job["formats"]):
            raise NotFound(f"El trabajo no generó {fmt}")
        path = self.settings.outputs_dir / job_id / f"resultado.{EXTENSIONS[fmt]}"
        if not path.exists():
            raise NotFound("Archivo de salida no encontrado")
        return path
