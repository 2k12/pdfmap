"""Archivos: registro, extracción (en segundo plano) a líneas cacheadas, lectura y búsqueda."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from ..config import Settings
from ..core.extraction import Line, open_extractor
from ..db import Database, now_iso
from .errors import Conflict, NotFound, ServiceError
from .jobs import JobContext, JobManager
from .security import check_signature, file_kind, safe_filename, valid_uuid

BATCH = 2000


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class FileService:
    def __init__(self, settings: Settings, db: Database, jobs: JobManager) -> None:
        self.settings = settings
        self.db = db
        self.jobs = jobs
        settings.files_dir.mkdir(parents=True, exist_ok=True)
        with db.connect() as conn:
            conn.execute(
                "UPDATE files SET status='error', error='Extracción interrumpida; vuelva a extraer' "
                "WHERE status='extracting'"
            )

    # -- Registro -----------------------------------------------------------------------------
    def register(self, source: Path, original_name: str, move: bool = True) -> dict[str, Any]:
        """Toma un archivo ya escrito en disco, lo valida, lo guarda y lanza la extracción."""
        name = safe_filename(original_name)
        kind = file_kind(name)
        check_signature(source, kind)
        size = source.stat().st_size
        if size > self.settings.max_upload_bytes:
            raise ServiceError("Archivo demasiado grande", 413)
        file_id = str(uuid.uuid4())
        target = self.path_of(file_id, kind)
        target.parent.mkdir(parents=True, exist_ok=True)
        if move:
            shutil.move(str(source), target)
        else:
            shutil.copyfile(source, target)
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO files (id, name, size, kind, sha256, status, created_at) "
                "VALUES (?,?,?,?,?, 'extracting', ?)",
                (file_id, name, size, kind, sha256_of(target), now_iso()),
            )
        self.start_extraction(file_id)
        return self.get(file_id)

    def path_of(self, file_id: str, kind: str) -> Path:
        return self.settings.files_dir / file_id / ("original.pdf" if kind == "pdf" else "original.txt")

    # -- Extracción ---------------------------------------------------------------------------
    def start_extraction(self, file_id: str, params: dict | None = None) -> str:
        info = self.get(file_id)
        running = [j for j in self.jobs.list(file_id=file_id) if j["status"] in ("queued", "running")]
        if running:
            raise Conflict("Hay un trabajo en curso para este archivo; espere o cancélelo")
        with self.db.connect() as conn:
            conn.execute("UPDATE files SET status='extracting', progress=0, error=NULL WHERE id=?", (file_id,))
        job_id = self.jobs.create("extract", file_id)
        path = self.path_of(file_id, info["kind"])

        result: dict = {}

        def work(ctx: JobContext) -> dict:
            result.update(self._extract(ctx, file_id, path, info["kind"], params or {}))
            return {"message": result["message"]}

        def finish(_: str, status: str, message: str) -> None:
            if status == "done":
                with self.db.connect() as conn:
                    conn.execute(
                        "UPDATE files SET status='ready', progress=1, pages=?, lines=?, extraction=?, error=NULL "
                        "WHERE id=?",
                        (result["pages"], result["lines"], json.dumps(result["params"]), file_id),
                    )
            else:
                with self.db.connect() as conn:
                    conn.execute(
                        "UPDATE files SET status='error', error=? WHERE id=?",
                        (message or "Extracción cancelada", file_id),
                    )

        self.jobs.submit(job_id, work, on_finish=finish)
        return job_id

    def _extract(self, ctx: JobContext, file_id: str, path: Path, kind: str, params: dict) -> dict:
        extractor = open_extractor(path, kind, params)
        try:
            if kind == "pdf" and not extractor.has_text():  # type: ignore[attr-defined]
                raise ServiceError("El PDF no tiene capa de texto (¿escaneado?). Se requiere OCR previo.")
            pages = extractor.page_count()
            total_lines = 0
            batch: list[tuple] = []
            with self.db.connect() as conn:
                conn.execute("DELETE FROM lines WHERE file_id=?", (file_id,))
            for page in range(1, pages + 1):
                ctx.raise_if_cancelled()
                for n, text in enumerate(extractor.page_lines(page), start=1):
                    batch.append((file_id, page, n, text))
                if len(batch) >= BATCH or page == pages:
                    with self.db.connect() as conn:
                        conn.executemany("INSERT INTO lines (file_id, page, n, text) VALUES (?,?,?,?)", batch)
                    total_lines += len(batch)
                    batch = []
                progress = page / pages
                ctx.progress(progress, f"Página {page} de {pages}")
                if page % 10 == 0 or page == pages:
                    with self.db.connect() as conn:
                        conn.execute("UPDATE files SET progress=? WHERE id=?", (round(progress, 4), file_id))
            raw_params = extractor.params  # type: ignore[attr-defined]
            params_out = raw_params.to_dict() if hasattr(raw_params, "to_dict") else dict(raw_params)
            return {
                "message": f"{pages} páginas, {total_lines} líneas",
                "pages": pages,
                "lines": total_lines,
                "params": params_out,
            }
        finally:
            extractor.close()

    # -- Consultas ----------------------------------------------------------------------------
    def get(self, file_id: str) -> dict[str, Any]:
        valid_uuid(file_id, "archivo")
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
        if row is None:
            raise NotFound("Archivo no encontrado")
        out = dict(row)
        out["extraction"] = json.loads(out["extraction"]) if out["extraction"] else None
        return out

    def list(self) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = conn.execute("SELECT id FROM files ORDER BY created_at DESC").fetchall()
        return [self.get(r["id"]) for r in rows]

    def require_ready(self, file_id: str) -> dict[str, Any]:
        info = self.get(file_id)
        if info["status"] != "ready":
            raise Conflict(f"El archivo no está listo (estado: {info['status']})")
        return info

    def page(self, file_id: str, page: int) -> dict[str, Any]:
        info = self.require_ready(file_id)
        if not 1 <= page <= (info["pages"] or 0):
            raise NotFound(f"Página {page} fuera de rango (1..{info['pages']})")
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT n, text FROM lines WHERE file_id=? AND page=? ORDER BY n", (file_id, page)
            ).fetchall()
        return {"page": page, "pages": info["pages"], "lines": [dict(r) for r in rows]}

    def iter_lines(self, file_id: str, start_page: int = 1, end_page: int | None = None) -> Iterator[Line]:
        """Recorre las líneas cacheadas en streaming (por bloques de páginas)."""
        info = self.require_ready(file_id)
        last = info["pages"] if end_page is None else min(end_page, info["pages"])
        page = start_page
        step = 50
        while page <= last:
            upto = min(page + step - 1, last)
            with self.db.connect() as conn:
                rows = conn.execute(
                    "SELECT page, n, text FROM lines WHERE file_id=? AND page BETWEEN ? AND ? ORDER BY page, n",
                    (file_id, page, upto),
                ).fetchall()
            for r in rows:
                yield Line(r["page"], r["n"], r["text"])
            page = upto + 1

    def search(self, file_id: str, pattern: str, mode: str = "contains", limit: int = 50) -> dict[str, Any]:
        if len(pattern) > self.settings.max_regex_length:
            raise ServiceError("Patrón demasiado largo", 422)
        if mode == "regex":
            try:
                rx = re.compile(pattern)
            except re.error as exc:
                raise ServiceError(f"Regex inválida: {exc}", 422) from exc
            test = lambda text: rx.search(text) is not None  # noqa: E731
        else:
            needle = pattern.lower()
            test = lambda text: needle in text.lower()  # noqa: E731
        matches: list[dict] = []
        for line in self.iter_lines(file_id):
            if test(line.text):
                if len(matches) >= limit:
                    return {"matches": matches, "truncated": True}
                matches.append({"page": line.page, "n": line.n, "text": line.text})
        return {"matches": matches, "truncated": False}

    def delete(self, file_id: str) -> None:
        self.get(file_id)
        for job in self.jobs.list(file_id=file_id):
            self.jobs.cancel(job["id"])
        with self.db.connect() as conn:
            conn.execute("DELETE FROM lines WHERE file_id=?", (file_id,))
            conn.execute("DELETE FROM job_rows WHERE job_id IN (SELECT id FROM jobs WHERE file_id=?)", (file_id,))
            job_ids = [r["id"] for r in conn.execute("SELECT id FROM jobs WHERE file_id=?", (file_id,))]
            conn.execute("DELETE FROM jobs WHERE file_id=?", (file_id,))
            conn.execute("DELETE FROM files WHERE id=?", (file_id,))
        shutil.rmtree(self.settings.files_dir / file_id, ignore_errors=True)
        for job_id in job_ids:
            shutil.rmtree(self.settings.outputs_dir / job_id, ignore_errors=True)
