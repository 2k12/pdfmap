"""RNF-01 (rendimiento) y RNF-02 (memoria constante). Umbrales configurables por entorno para
no generar falsos fallos en máquinas lentas de CI:

    PDFMAP_PERF_MIN_PAGES_S   (por defecto 15 págs/s; objetivo de producción 40)
    PDFMAP_PERF_MIN_LINES_S   (por defecto 20000 líneas/s en el motor)
    PDFMAP_PERF_PAGES         (por defecto 200 páginas sintéticas)
"""

import os
import time
import tracemalloc
from datetime import datetime
from decimal import Decimal

import pytest

from app.core.export import ExcelExporter
from app.core.extraction import PdfExtractor, iter_lines
from app.core.extraction.base import Line
from app.core.mapping import MappingEngine
from tests.conftest import engine_template, upload_file, wait_file_ready
from tests.fixtures.generate_fixtures import build_report, write_pdf

pytestmark = pytest.mark.slow
PAGES = int(os.getenv("PDFMAP_PERF_PAGES", "200"))
MIN_PAGES_S = float(os.getenv("PDFMAP_PERF_MIN_PAGES_S", "15"))
MIN_LINES_S = float(os.getenv("PDFMAP_PERF_MIN_LINES_S", "20000"))


@pytest.fixture(scope="module")
def big_pdf(tmp_path_factory):
    pages, expected = build_report(pages=PAGES, seed=99)
    return write_pdf(pages, tmp_path_factory.mktemp("perf") / "big.pdf"), expected


@pytest.mark.req("RNF-01")
def test_extraction_throughput(big_pdf):
    path, _ = big_pdf
    started = time.perf_counter()
    with PdfExtractor(str(path)) as ex:
        n = sum(1 for _ in iter_lines(ex))
        pages = ex.page_count()
    rate = pages / (time.perf_counter() - started)
    print(f"\nExtracción: {pages} páginas, {n} líneas, {rate:.1f} págs/s")
    assert rate >= MIN_PAGES_S


@pytest.mark.req("RNF-01")
def test_engine_throughput(ventas_template):
    lines = []
    for v in range(2000):
        lines.append(Line(1, len(lines) + 1, f"Vendedor: V{v % 999:03d} NOMBRE            Zona: NORTE"))
        for i in range(25):
            lines.append(
                Line(1, len(lines) + 1, f"05/07/2026  F-{i:06d}  CLIENTE DEMO                    10    1,250.50")
            )
    engine = MappingEngine(engine_template(ventas_template))
    started = time.perf_counter()
    rows = sum(1 for _ in engine.process(lines))
    rate = len(lines) / (time.perf_counter() - started)
    print(f"\nMotor: {len(lines)} líneas -> {rows} filas, {rate:,.0f} líneas/s")
    assert rows == 50_000
    assert rate >= MIN_LINES_S


@pytest.mark.req("RNF-02")
def test_excel_export_memory_is_constant(tmp_path):
    """La memoria de exportar 100k filas debe ser similar a la de 10k (streaming, no acumulativa)."""
    cols = [{"id": f"c{i}", "header": f"C{i}"} for i in range(8)]
    types = {
        f"c{i}": t for i, t in enumerate(["text", "date", "number", "number", "text", "integer", "text", "number"])
    }
    row = ["texto de prueba", datetime(2026, 1, 1), Decimal("1.5"), Decimal("2.5"), "x" * 30, 7, "y", Decimal(9)]

    def peak(n: int) -> int:
        tracemalloc.start()
        ex = ExcelExporter(tmp_path / f"m{n}.xlsx", cols, {}, types)
        for _ in range(n):
            ex.write(row)
        ex.close()
        _, top = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        return top

    small, large = peak(10_000), peak(100_000)
    print(f"\nPico de memoria: 10k={small / 1e6:.1f} MB, 100k={large / 1e6:.1f} MB")
    assert large < small * 3 + 5_000_000  # 10× filas no debe multiplicar la memoria


@pytest.mark.req("RNF-01", "RF-12")
def test_preview_latency(client, big_pdf, ventas_template):
    path, _ = big_pdf
    info = wait_file_ready(client, upload_file(client, path)["id"])
    started = time.perf_counter()
    res = client.post(
        "/api/v1/mapping/preview", json={"file_id": info["id"], "template": ventas_template, "max_pages": 20}
    )
    elapsed = time.perf_counter() - started
    print(f"\nVista previa de 20 páginas: {elapsed * 1000:.0f} ms")
    assert res.status_code == 200
    assert elapsed < 2.0
