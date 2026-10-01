"""RF-13 · Gestión de plantillas: CRUD, plantilla precargada protegida, clonado."""

import pytest

API = "/api/v1/templates"
BUILTIN = "builtin-ventas-ejemplo"

pytestmark = pytest.mark.req("RF-13")


def test_builtin_listed_and_readable(client):
    items = client.get(API).json()
    assert items[0]["id"] == BUILTIN and items[0]["builtin"] is True
    tpl = client.get(f"{API}/{BUILTIN}").json()
    assert tpl["builtin"] is True
    assert [r["id"] for r in tpl["rules"]] == ["encabezado", "vendedor", "venta", "nota", "total_vendedor"]


def test_crud_cycle(client, ventas_template):
    created = client.post(API, json=ventas_template)
    assert created.status_code == 201
    tpl = created.json()
    assert tpl["id"] and tpl["version"] == 1
    tpl["name"] = "Ventas v2"
    updated = client.put(f"{API}/{tpl['id']}", json=tpl).json()
    assert updated["name"] == "Ventas v2" and updated["version"] == 2
    assert any(t["name"] == "Ventas v2" for t in client.get(API).json())
    assert client.delete(f"{API}/{tpl['id']}").status_code == 204
    assert client.get(f"{API}/{tpl['id']}").status_code == 404


def test_builtin_cannot_be_modified_but_can_be_cloned(client):
    tpl = client.get(f"{API}/{BUILTIN}").json()
    assert client.put(f"{API}/{BUILTIN}", json=tpl).status_code == 403
    assert client.delete(f"{API}/{BUILTIN}").status_code == 403
    clone = client.post(API, json={**tpl, "name": "Mis ventas"}).json()
    assert clone["id"] != BUILTIN and clone["name"] == "Mis ventas"


def test_invalid_template_rejected(client, ventas_template):
    bad = {**ventas_template, "rules": ventas_template["rules"] * 2}
    assert client.post(API, json=bad).status_code == 422


def test_unknown_template(client, ventas_template):
    assert client.get(f"{API}/nope").status_code == 404
    assert client.put(f"{API}/nope", json=ventas_template).status_code == 404
    assert client.delete(f"{API}/nope").status_code == 404
