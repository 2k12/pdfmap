"""RF-07 (regex sugerida), RF-08 (columnas sugeridas), RF-12 (anotación y vista previa), RF-13 (validar)."""

import pytest

API = "/api/v1/mapping"


@pytest.mark.req("RF-07")
def test_suggest_regex(client):
    res = client.post(f"{API}/suggest-regex", json={"line": "05/07/2026  F-000101  CLIENTE", "tokens": 2})
    assert res.status_code == 200
    assert res.json()["regex"] == r"^\d{2}/\d{2}/\d{4}\s+[A-Z]\-\d{6}"


@pytest.mark.req("RF-08")
def test_suggest_columns(client):
    lines = [
        "05/07/2026  F-000101  DISTRIBUIDORA EL SOL           334    8,102.11",
        "04/06/2026  F-000102  MUEBLES ARTESANALES            299    9,731.60",
    ]
    segments = client.post(f"{API}/suggest-columns", json={"lines": lines, "min_gap": 2}).json()["segments"]
    assert segments[0] == {"start": 0, "end": 10, "type": "date", "date_formats": ["%d/%m/%Y"]}
    assert segments[1]["start"] == 12 and segments[1]["type"] == "text"
    assert segments[-1]["type"] == "number"


@pytest.mark.req("RF-08")
def test_suggest_columns_requires_lines(client):
    assert client.post(f"{API}/suggest-columns", json={"lines": []}).status_code == 422


@pytest.mark.req("RF-13")
def test_validate_template(client, ventas_template):
    assert client.post(f"{API}/validate", json={"template": ventas_template}).json() == {"valid": True, "errors": []}
    bad = {**ventas_template, "columns": [{"id": "x", "header": "X", "sources": ["no.existe"]}]}
    out = client.post(f"{API}/validate", json={"template": bad}).json()
    assert out["valid"] is False and "fuente desconocida" in out["errors"][0]


@pytest.mark.req("RF-12", "RF-07")
def test_annotate_page(client, ready_file, ventas_template):
    res = client.post(f"{API}/annotate", json={"file_id": ready_file["id"], "template": ventas_template, "page": 1})
    assert res.status_code == 200, res.text
    lines = res.json()["lines"]
    rules = [ln["rule"] for ln in lines]
    assert rules[:5] == ["encabezado"] * 4 + ["vendedor"]
    venta = lines[5]
    assert venta["rule"] == "venta" and venta["values"]["factura"] == "F-000123"
    assert venta["values"]["fecha"] == "2026-02-01" and isinstance(venta["values"]["total"], float)


@pytest.mark.req("RF-12")
def test_preview_rows_and_stats(client, ready_file, ventas_template):
    res = client.post(
        f"{API}/preview", json={"file_id": ready_file["id"], "template": ventas_template, "max_pages": 1, "limit": 3}
    )
    body = res.json()
    assert [c["header"] for c in body["columns"]][:3] == ["Vendedor", "Nombre", "Zona"]
    assert body["columns"][3]["type"] == "date"
    assert len(body["rows"]) == 3
    assert body["rows"][0][:3] == ["V001", "ANA PEREZ", "NORTE"]
    assert body["stats"]["rows"] > 3  # las estadísticas cubren toda la página, no solo el límite


@pytest.mark.req("RF-12")
def test_preview_with_invalid_template_is_422(client, ready_file):
    res = client.post(f"{API}/preview", json={"file_id": ready_file["id"], "template": {"name": ""}})
    assert res.status_code == 422


@pytest.mark.req("RF-12")
def test_preview_unknown_file_404(client, ventas_template):
    res = client.post(
        f"{API}/preview", json={"file_id": "00000000-0000-0000-0000-000000000000", "template": ventas_template}
    )
    assert res.status_code == 404
