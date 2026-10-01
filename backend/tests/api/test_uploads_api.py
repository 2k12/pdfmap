"""RF-01, RF-02, RF-03 · Carga simple y por fragmentos (reanudable, en desorden), validaciones."""

import math

import pytest

from tests.conftest import upload_file, wait_file_ready

API = "/api/v1"


def init(client, name, size):
    res = client.post(f"{API}/uploads", json={"filename": name, "size": size})
    assert res.status_code == 201, res.text
    return res.json()


def put(client, upload_id, index, data):
    return client.put(
        f"{API}/uploads/{upload_id}/chunks/{index}", content=data, headers={"Content-Type": "application/octet-stream"}
    )


@pytest.mark.req("RF-01")
def test_simple_multipart_upload_and_extraction(client, sample_pdf):
    info = upload_file(client, sample_pdf)
    assert info["name"] == "sample_report.pdf" and info["kind"] == "pdf"
    assert info["status"] in ("extracting", "ready")
    ready = wait_file_ready(client, info["id"])
    assert ready["pages"] == 4 and ready["lines"] > 100 and ready["progress"] == 1
    assert ready["extraction"]["char_width"] == pytest.approx(4.2, abs=0.01)


@pytest.mark.req("RF-01")
def test_upload_txt(client, sample_txt):
    ready = wait_file_ready(client, upload_file(client, sample_txt)["id"])
    assert ready["kind"] == "text" and ready["pages"] == 4


@pytest.mark.req("RF-02")
def test_chunked_upload_out_of_order_and_resume(client, sample_txt, settings):
    # Relleno de líneas vacías al final: fuerza 3 fragmentos sin cambiar el contenido útil.
    data = sample_txt.read_bytes() + b"\n" * (settings.chunk_size * 2)
    up = init(client, "grande.txt", len(data))
    cs = up["chunk_size"]
    assert up["total_chunks"] == math.ceil(len(data) / cs) == 3
    for index in (2, 0):
        res = put(client, up["upload_id"], index, data[index * cs : (index + 1) * cs])
        assert res.status_code == 200, res.text
    status = client.get(f"{API}/uploads/{up['upload_id']}").json()
    assert status["received"] == [0, 2]  # reanudación: el cliente sabe qué falta
    res = client.post(f"{API}/uploads/{up['upload_id']}/complete")
    assert res.status_code == 409 and "Faltan 1" in res.json()["detail"]
    put(client, up["upload_id"], 1, data[cs : 2 * cs])
    res = client.post(f"{API}/uploads/{up['upload_id']}/complete")
    assert res.status_code == 201, res.text
    ready = wait_file_ready(client, res.json()["id"])
    assert ready["size"] == len(data) and ready["pages"] == 4
    assert client.get(f"{API}/uploads/{up['upload_id']}").status_code == 404  # temporales borrados


@pytest.mark.req("RF-02")
def test_chunk_validation(client):
    up = init(client, "a.pdf", 10)
    assert put(client, up["upload_id"], 5, b"x").status_code == 400
    res = put(client, up["upload_id"], 0, b"123")
    assert res.status_code == 400 and "esperaban 10" in res.json()["detail"]


@pytest.mark.req("RF-02")
def test_abort_upload(client):
    up = init(client, "a.pdf", 10)
    assert client.delete(f"{API}/uploads/{up['upload_id']}").status_code == 204
    assert client.get(f"{API}/uploads/{up['upload_id']}").status_code == 404


@pytest.mark.req("RF-03")
@pytest.mark.parametrize("name", ["virus.exe", "hoja.xlsx", "sin_extension"])
def test_unsupported_extension_rejected_before_data(client, name):
    res = client.post(f"{API}/uploads", json={"filename": name, "size": 10})
    assert res.status_code == 415


@pytest.mark.req("RF-03")
def test_size_limit(client, settings):
    res = client.post(f"{API}/uploads", json={"filename": "a.pdf", "size": settings.max_upload_bytes + 1})
    assert res.status_code == 413
    res = client.post(f"{API}/uploads", json={"filename": "a.pdf", "size": 0})
    assert res.status_code == 422


@pytest.mark.req("RF-03")
def test_fake_pdf_rejected_by_signature(client, tmp_path):
    fake = tmp_path / "fake.pdf"
    fake.write_bytes(b"esto no es un pdf")
    with fake.open("rb") as fh:
        res = client.post(f"{API}/files", files={"file": ("fake.pdf", fh)})
    assert res.status_code == 415

    up = init(client, "fake2.pdf", 17)
    put(client, up["upload_id"], 0, b"esto no es un pdf")
    assert client.post(f"{API}/uploads/{up['upload_id']}/complete").status_code == 415


@pytest.mark.req("RF-03")
def test_empty_multipart_rejected(client, tmp_path):
    empty = tmp_path / "vacio.pdf"
    empty.write_bytes(b"")
    with empty.open("rb") as fh:
        assert client.post(f"{API}/files", files={"file": ("vacio.pdf", fh)}).status_code == 400


@pytest.mark.req("RF-04")
def test_scanned_pdf_without_text_reports_error(client, tmp_path):
    from tests.fixtures.generate_fixtures import write_pdf

    pdf = write_pdf([[]], tmp_path / "escaneado.pdf")
    info = upload_file(client, pdf)
    from tests.conftest import wait_for

    final = wait_for(lambda: client.get(f"{API}/files/{info['id']}").json(), lambda v: v["status"] != "extracting")
    assert final["status"] == "error" and "OCR" in final["error"]
