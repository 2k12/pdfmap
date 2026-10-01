"""Regresión con archivos dorados: la salida de la plantilla sobre el reporte sintético no debe
cambiar sin intención. Si el cambio es intencional:  pytest tests/regression --update-golden"""

import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest

from app.core.extraction import PdfExtractor, iter_lines
from app.core.mapping import MappingEngine
from tests.conftest import engine_template

GOLDEN = Path(__file__).resolve().parent / "golden"


def _json(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, Decimal):
        return str(value)
    return value


def _run(pdf: Path, template: dict) -> dict:
    engine = MappingEngine(engine_template(template))
    with PdfExtractor(str(pdf)) as ex:
        rows = [[_json(v) for v in row] for row in engine.process(iter_lines(ex))]
    stats = engine.finish_stats()
    return {
        "rows": rows,
        "stats": {
            k: stats[k] for k in ("rows", "unmatched", "rule_hits", "error_count", "checks_ok", "checks_failed_count")
        },
    }


@pytest.mark.req("RF-10", "RF-15", "RF-16")
def test_ventas_sample_matches_golden(request, sample_pdf, ventas_template):
    path = GOLDEN / "ventas_sample.json"
    actual = _run(sample_pdf, ventas_template)
    if request.config.getoption("--update-golden") or not path.exists():
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(actual, ensure_ascii=False, indent=1), encoding="utf-8")
        pytest.skip("Archivo dorado regenerado")
    expected = json.loads(path.read_text(encoding="utf-8"))
    assert actual["stats"] == expected["stats"]
    for i, (a, e) in enumerate(zip(actual["rows"], expected["rows"])):
        assert a == e, f"Fila {i} difiere"
    assert len(actual["rows"]) == len(expected["rows"])
