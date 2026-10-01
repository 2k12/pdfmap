"""Ejecución de trabajos en segundo plano (hilos) con progreso persistente y cancelación."""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

from ..db import Database, now_iso
from .errors import NotFound

log = logging.getLogger("pdfmap.jobs")

TERMINAL = {"done", "error", "cancelled"}


class Cancelled(Exception):
    pass


class JobContext:
    def __init__(self, manager: JobManager, job_id: str) -> None:
        self.manager = manager
        self.job_id = job_id
        self.cancel_event = threading.Event()
        self._last = 0.0

    @property
    def cancelled(self) -> bool:
        return self.cancel_event.is_set()

    def raise_if_cancelled(self) -> None:
        if self.cancelled:
            raise Cancelled()

    def progress(self, value: float, message: str | None = None, force: bool = False) -> None:
        """Persiste el progreso como máximo cada 0,3 s para no saturar SQLite."""
        now = time.monotonic()
        if not force and now - self._last < 0.3:
            return
        self._last = now
        self.manager.update(
            self.job_id,
            progress=round(min(max(value, 0.0), 1.0), 4),
            **({"message": message} if message is not None else {}),
        )


class JobManager:
    def __init__(self, db: Database, workers: int = 2) -> None:
        self.db = db
        self.executor = ThreadPoolExecutor(max_workers=max(1, workers), thread_name_prefix="pdfmap-job")
        self._contexts: dict[str, JobContext] = {}
        self._futures: dict[str, Future] = {}
        self._lock = threading.Lock()
        self._recover()

    def _recover(self) -> None:
        with self.db.connect() as conn:
            conn.execute(
                "UPDATE jobs SET status='error', message='Interrumpido por reinicio del servidor', finished_at=? "
                "WHERE status IN ('queued','running')",
                (now_iso(),),
            )

    def create(
        self,
        kind: str,
        file_id: str,
        template_id: str | None = None,
        template: dict | None = None,
        formats: list[str] | None = None,
    ) -> str:
        job_id = str(uuid.uuid4())
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO jobs (id, kind, file_id, template_id, template, formats, status, created_at) "
                "VALUES (?,?,?,?,?,?, 'queued', ?)",
                (
                    job_id,
                    kind,
                    file_id,
                    template_id,
                    json.dumps(template) if template else None,
                    json.dumps(formats or []),
                    now_iso(),
                ),
            )
        return job_id

    def submit(
        self,
        job_id: str,
        fn: Callable[[JobContext], dict[str, Any] | None],
        on_finish: Callable[[str, str, str], None] | None = None,
    ) -> None:
        ctx = JobContext(self, job_id)
        with self._lock:
            self._contexts[job_id] = ctx

        def run() -> None:
            status, message = "done", ""
            try:
                ctx.raise_if_cancelled()
                self.update(job_id, status="running")
                extra = fn(ctx) or {}
                self.update(job_id, progress=1.0, **extra)
            except Cancelled:
                status, message = "cancelled", "Cancelado por el usuario"
            except Exception as exc:
                log.exception("Trabajo %s falló", job_id)
                status, message = "error", str(exc) or exc.__class__.__name__
            finally:
                self.update(job_id, status=status, finished_at=now_iso(), **({"message": message} if message else {}))
                # El callback corre con el trabajo ya cerrado: quien vea su efecto no verá el trabajo activo.
                if on_finish:
                    try:
                        on_finish(job_id, status, message)
                    except Exception:
                        log.exception("Callback de fin de trabajo falló")
                with self._lock:
                    self._contexts.pop(job_id, None)

        with self._lock:
            future = self.executor.submit(run)
            self._futures[job_id] = future

        def forget(_: Future) -> None:
            with self._lock:
                if self._futures.get(job_id) is future:
                    self._futures.pop(job_id, None)

        future.add_done_callback(forget)

    def update(self, job_id: str, **values: Any) -> None:
        if not values:
            return
        if "stats" in values and not isinstance(values["stats"], str):
            values["stats"] = json.dumps(values["stats"])
        if "columns" in values and not isinstance(values["columns"], str):
            values["columns"] = json.dumps(values["columns"])
        cols = ", ".join(f"{k}=?" for k in values)
        with self.db.connect() as conn:
            conn.execute(f"UPDATE jobs SET {cols} WHERE id=?", (*values.values(), job_id))  # noqa: S608  # nosec B608

    def get(self, job_id: str) -> dict[str, Any]:
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if row is None:
            raise NotFound("Trabajo no encontrado")
        return dict(row)

    def list(self, file_id: str | None = None, kind: str | None = None) -> list[dict[str, Any]]:
        sql, params = "SELECT * FROM jobs WHERE 1=1", []
        if file_id:
            sql += " AND file_id=?"
            params.append(file_id)
        if kind:
            sql += " AND kind=?"
            params.append(kind)
        with self.db.connect() as conn:
            return [dict(r) for r in conn.execute(sql + " ORDER BY created_at DESC", params)]

    def cancel(self, job_id: str) -> None:
        job = self.get(job_id)
        if job["status"] in TERMINAL:
            return
        with self._lock:
            ctx = self._contexts.get(job_id)
            future = self._futures.get(job_id)
        if ctx:
            ctx.cancel_event.set()
        if future and future.cancel():  # aún en cola: nunca empezará
            self.update(job_id, status="cancelled", message="Cancelado por el usuario", finished_at=now_iso())

    def wait(self, job_id: str, timeout: float | None = None) -> None:
        """Bloquea hasta que termine (útil en pruebas y en la CLI)."""
        with self._lock:
            future = self._futures.get(job_id)
        if future:
            try:
                future.result(timeout=timeout)
            except Exception:  # noqa: BLE001 - el estado queda en la tabla jobs
                log.debug("Trabajo %s terminó con error", job_id)

    def shutdown(self) -> None:
        with self._lock:
            for ctx in self._contexts.values():
                ctx.cancel_event.set()
        self.executor.shutdown(wait=True, cancel_futures=True)
