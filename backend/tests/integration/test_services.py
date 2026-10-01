"""Integración de servicios con SQLite y disco: trabajos, recuperación tras reinicio y limpieza."""

import json
import threading
import time

import pytest

from app.db import Database
from app.services.container import Services
from app.services.jobs import JobManager
from tests.conftest import wait_for


@pytest.fixture
def db(tmp_path):
    return Database(tmp_path / "t.sqlite3")


@pytest.mark.req("RF-14", "RNF-08")
def test_job_lifecycle_done(db):
    jm = JobManager(db, workers=1)
    job_id = jm.create("export", "f")
    jm.submit(job_id, lambda ctx: {"rows": 5, "stats": {"ok": True}})
    jm.wait(job_id, 5)
    job = wait_for(lambda: jm.get(job_id), lambda j: j["status"] == "done")
    assert job["progress"] == 1.0 and job["rows"] == 5 and json.loads(job["stats"]) == {"ok": True}
    jm.shutdown()


@pytest.mark.req("RF-14", "RNF-08")
def test_job_error_is_recorded(db):
    jm = JobManager(db, workers=1)
    job_id = jm.create("export", "f")

    def boom(ctx):
        raise RuntimeError("fallo controlado")

    jm.submit(job_id, boom)
    job = wait_for(lambda: jm.get(job_id), lambda j: j["status"] == "error")
    assert job["message"] == "fallo controlado"
    jm.shutdown()


@pytest.mark.req("RF-14")
def test_job_cancellation_running_and_queued(db):
    jm = JobManager(db, workers=1)
    started = threading.Event()

    def long(ctx):
        started.set()
        while True:
            ctx.raise_if_cancelled()
            ctx.progress(0.5, "trabajando")
            time.sleep(0.01)

    running = jm.create("export", "f")
    queued = jm.create("export", "f")
    jm.submit(running, long)
    jm.submit(queued, long)
    assert started.wait(5)
    jm.cancel(queued)
    jm.cancel(running)
    assert wait_for(lambda: jm.get(running), lambda j: j["status"] == "cancelled")
    assert jm.get(queued)["status"] == "cancelled"
    jm.cancel(running)  # idempotente sobre estados terminales
    jm.shutdown()


@pytest.mark.req("RNF-08")
def test_interrupted_jobs_are_marked_on_restart(db):
    jm = JobManager(db, workers=1)
    job_id = jm.create("export", "f")
    jm.update(job_id, status="running")
    jm.shutdown()
    jm2 = JobManager(db, workers=1)
    job = jm2.get(job_id)
    assert job["status"] == "error" and "reinicio" in job["message"]
    jm2.shutdown()


@pytest.mark.req("RF-02")
def test_stale_uploads_are_cleaned(settings):
    services = Services.build(settings)
    up = services.uploads.init("a.pdf", 10)
    meta_path = settings.uploads_dir / up["upload_id"] / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["created"] = 0
    meta_path.write_text(json.dumps(meta))
    (settings.uploads_dir / "basura").mkdir()
    assert services.uploads.cleanup_stale() == 2
    services.close()


@pytest.mark.req("RF-13")
def test_builtin_templates_seeded_idempotently(settings):
    s1 = Services.build(settings)
    s1.close()
    s2 = Services.build(settings)
    builtins = [t for t in s2.templates.list() if t["builtin"]]
    assert len(builtins) == 1 and builtins[0]["id"] == "builtin-ventas-ejemplo"
    s2.close()
