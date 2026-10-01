import pytest

from app.config import VERSION


@pytest.mark.req("RNF-07")
def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": VERSION}


@pytest.mark.req("RNF-06")
def test_docs_available(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").json()["info"]["title"] == "PDFMap API"
