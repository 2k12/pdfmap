"""Fixtures compartidas y reporte de cobertura de requisitos (trazabilidad RF/RNF → pruebas)."""

from __future__ import annotations

import json
import time
from collections import defaultdict
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
BACKEND = ROOT.parent
_SUITES = ("unit", "integration", "api", "contract", "security", "performance", "regression", "e2e")


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--update-golden", action="store_true", help="regenera los archivos dorados de regresión")


# --- Marcadores automáticos por carpeta + trazabilidad de requisitos --------------------------
_REQ_RESULTS: dict[str, dict[str, int]] = defaultdict(lambda: {"passed": 0, "failed": 0, "skipped": 0})


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        parts = Path(str(item.fspath)).relative_to(ROOT).parts
        if parts and parts[0] in _SUITES:
            item.add_marker(getattr(pytest.mark, parts[0]))


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo) -> Iterator[None]:
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" or (report.when == "setup" and report.skipped):
        for marker in item.iter_markers("req"):
            for req in marker.args:
                key = "passed" if report.passed else "skipped" if report.skipped else "failed"
                _REQ_RESULTS[req][key] += 1


def pytest_terminal_summary(terminalreporter: Any) -> None:
    if not _REQ_RESULTS:
        return
    out_dir = BACKEND / "reports"
    out_dir.mkdir(exist_ok=True)
    lines = [
        "# Cobertura de requisitos (backend)",
        "",
        "| Requisito | Pasaron | Fallaron | Omitidas |",
        "|---|---|---|---|",
    ]
    key = lambda r: (r.split("-")[0], int(r.split("-")[1]))  # noqa: E731
    for req in sorted(_REQ_RESULTS, key=key):
        r = _REQ_RESULTS[req]
        lines.append(f"| {req} | {r['passed']} | {r['failed']} | {r['skipped']} |")
    (out_dir / "requirements-coverage.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out_dir / "requirements-coverage.json").write_text(json.dumps(_REQ_RESULTS, indent=2), encoding="utf-8")
    terminalreporter.write_sep(
        "-", f"Requisitos verificados: {len(_REQ_RESULTS)} (ver reports/requirements-coverage.md)"
    )


# --- Datos -------------------------------------------------------------------------------------
@pytest.fixture(scope="session")
def sample_pdf() -> Path:
    path = FIXTURES / "sample_report.pdf"
    if not path.exists():
        from tests.fixtures.generate_fixtures import build_report, write_pdf, write_txt

        pages, _ = build_report()
        write_pdf(pages, path)
        write_txt(pages, path.with_suffix(".txt"))
    return path


@pytest.fixture(scope="session")
def sample_txt(sample_pdf: Path) -> Path:
    return sample_pdf.with_suffix(".txt")


@pytest.fixture
def ventas_template() -> dict:
    return json.loads((FIXTURES / "ventas_template.json").read_text(encoding="utf-8"))


@pytest.fixture
def builtin_template() -> dict:
    path = BACKEND / "app" / "templates_builtin" / "ventas_ejemplo.json"
    return json.loads(path.read_text(encoding="utf-8"))


def engine_template(raw: dict) -> dict:
    """Plantilla validada y normalizada (con valores por defecto), como la recibe el motor."""
    from app.schemas import Template

    return Template.model_validate(raw).engine_dict()


# --- Aplicación ----------------------------------------------------------------------------
@pytest.fixture
def settings(tmp_path: Path):
    from app.config import Settings

    return Settings(data_dir=tmp_path / "data", chunk_size_mb=1, max_upload_mb=50, workers=2, api_key=None)


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(settings)) as c:
        yield c


def wait_for(fn, predicate, timeout: float = 60.0, interval: float = 0.05):
    deadline = time.monotonic() + timeout
    value = fn()
    while not predicate(value):
        if time.monotonic() > deadline:
            raise AssertionError(f"Tiempo de espera agotado; último valor: {value}")
        time.sleep(interval)
        value = fn()
    return value


def upload_file(client, path: Path, name: str | None = None) -> dict:
    with path.open("rb") as fh:
        res = client.post("/api/v1/files", files={"file": (name or path.name, fh, "application/octet-stream")})
    assert res.status_code == 201, res.text
    return res.json()


def wait_file_ready(client, file_id: str) -> dict:
    info = wait_for(lambda: client.get(f"/api/v1/files/{file_id}").json(), lambda v: v["status"] in ("ready", "error"))
    assert info["status"] == "ready", info
    return info


def wait_job(client, job_id: str) -> dict:
    return wait_for(
        lambda: client.get(f"/api/v1/jobs/{job_id}").json(), lambda v: v["status"] in ("done", "error", "cancelled")
    )


@pytest.fixture
def ready_file(client, sample_pdf) -> dict:
    return wait_file_ready(client, upload_file(client, sample_pdf)["id"])
