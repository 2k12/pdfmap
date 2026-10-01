"""RF-04 (re-extracción), RF-05 (páginas), RF-06 (búsqueda), RF-18 (eliminación)."""

import pytest

from tests.conftest import upload_file, wait_file_ready, wait_for

API = "/api/v1"


@pytest.mark.req("RF-05")
def test_get_page_lines(client, ready_file):
    res = client.get(f"{API}/files/{ready_file['id']}/pages/1")
    assert res.status_code == 200
    body = res.json()
    assert body["page"] == 1 and body["pages"] == 4
    assert body["lines"][0] == {"n": 1, "text": "EMPRESA DEMO S.A.                                           Pag. 1"}
    assert body["lines"][4]["text"].startswith("Vendedor: V001")


@pytest.mark.req("RF-05")
@pytest.mark.parametrize("page", [0, 5, 999])
def test_page_out_of_range(client, ready_file, page):
    assert client.get(f"{API}/files/{ready_file['id']}/pages/{page}").status_code == 404


@pytest.mark.req("RF-05")
def test_list_and_get_files(client, ready_file):
    files = client.get(f"{API}/files").json()
    assert [f["id"] for f in files] == [ready_file["id"]]
    assert client.get(f"{API}/files/{ready_file['id']}").json()["status"] == "ready"


@pytest.mark.req("RF-06")
def test_search_contains_and_regex(client, ready_file):
    fid = ready_file["id"]
    res = client.get(f"{API}/files/{fid}/search", params={"pattern": "total vendedor"}).json()
    assert len(res["matches"]) == 15 and not res["truncated"]
    res = client.get(f"{API}/files/{fid}/search", params={"pattern": r"^Vendedor: V00[12]", "mode": "regex"}).json()
    assert [m["text"][:14] for m in res["matches"]] == ["Vendedor: V001", "Vendedor: V002"]
    res = client.get(f"{API}/files/{fid}/search", params={"pattern": "F-", "limit": 5}).json()
    assert len(res["matches"]) == 5 and res["truncated"]


@pytest.mark.req("RF-06")
def test_search_invalid_regex(client, ready_file):
    res = client.get(f"{API}/files/{ready_file['id']}/search", params={"pattern": "(", "mode": "regex"})
    assert res.status_code == 422
    res = client.get(f"{API}/files/{ready_file['id']}/search", params={"pattern": "x", "mode": "glob"})
    assert res.status_code == 422


@pytest.mark.req("RF-04")
def test_reextract_with_manual_params(client, ready_file):
    fid = ready_file["id"]
    res = client.post(f"{API}/files/{fid}/extract", json={"char_width": 8.4})
    assert res.status_code == 202
    info = wait_file_ready(client, fid)
    assert info["extraction"]["char_width"] == 8.4
    line = client.get(f"{API}/files/{fid}/pages/1").json()["lines"][0]["text"]
    assert line.startswith("EMPRESA") and len(line) < 50  # columnas comprimidas a la mitad


@pytest.mark.req("RF-04")
def test_reextract_invalid_params(client, ready_file):
    assert client.post(f"{API}/files/{ready_file['id']}/extract", json={"char_width": -1}).status_code == 422


@pytest.mark.req("RF-04")
def test_page_not_available_while_extracting(client, tmp_path):
    from tests.fixtures.generate_fixtures import build_report, write_pdf

    pages, _ = build_report(pages=60)
    info = upload_file(client, write_pdf(pages, tmp_path / "mediano.pdf"))
    res = client.get(f"{API}/files/{info['id']}/pages/1")
    assert res.status_code in (200, 409)  # 409 si aún está extrayendo
    wait_file_ready(client, info["id"])


@pytest.mark.req("RF-18")
def test_delete_file_removes_everything(client, ready_file, settings, ventas_template):
    fid = ready_file["id"]
    job = client.post(f"{API}/jobs", json={"file_id": fid, "template": ventas_template}).json()
    wait_for(lambda: client.get(f"{API}/jobs/{job['id']}").json(), lambda j: j["status"] == "done")
    assert client.delete(f"{API}/files/{fid}").status_code == 204
    assert client.get(f"{API}/files/{fid}").status_code == 404
    assert client.get(f"{API}/jobs/{job['id']}").status_code == 404
    assert not (settings.files_dir / fid).exists()
    assert not (settings.outputs_dir / job["id"]).exists()
    assert client.delete(f"{API}/files/{fid}").status_code == 404
