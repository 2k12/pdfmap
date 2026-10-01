"""Pruebas de contrato: el esquema OpenAPI publicado coincide con docs/architecture/api-contract.md
(rutas, métodos y campos de los modelos principales). Si alguien cambia la API sin actualizar el
contrato/frontend, esta suite falla."""

import pytest

pytestmark = pytest.mark.req("RNF-06")

EXPECTED = {
    "/api/v1/health": {"get"},
    "/api/v1/uploads": {"post"},
    "/api/v1/uploads/{upload_id}": {"get", "delete"},
    "/api/v1/uploads/{upload_id}/chunks/{index}": {"put"},
    "/api/v1/uploads/{upload_id}/complete": {"post"},
    "/api/v1/files": {"get", "post"},
    "/api/v1/files/{file_id}": {"get", "delete"},
    "/api/v1/files/{file_id}/extract": {"post"},
    "/api/v1/files/{file_id}/pages/{page}": {"get"},
    "/api/v1/files/{file_id}/search": {"get"},
    "/api/v1/mapping/suggest-regex": {"post"},
    "/api/v1/mapping/suggest-columns": {"post"},
    "/api/v1/mapping/validate": {"post"},
    "/api/v1/mapping/annotate": {"post"},
    "/api/v1/mapping/preview": {"post"},
    "/api/v1/templates": {"get", "post"},
    "/api/v1/templates/{template_id}": {"get", "put", "delete"},
    "/api/v1/jobs": {"get", "post"},
    "/api/v1/jobs/{job_id}": {"get"},
    "/api/v1/jobs/{job_id}/rows": {"get"},
    "/api/v1/jobs/{job_id}/download": {"get"},
    "/api/v1/jobs/{job_id}/cancel": {"post"},
}


@pytest.fixture
def spec(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    return res.json()


def test_paths_and_methods_match_contract(spec):
    actual = {path: set(ops) for path, ops in spec["paths"].items()}
    assert actual == EXPECTED


@pytest.mark.parametrize(
    ("schema", "fields"),
    [
        (
            "FileOut",
            {"id", "name", "size", "kind", "status", "progress", "pages", "lines", "error", "created_at", "extraction"},
        ),
        (
            "JobOut",
            {
                "id",
                "kind",
                "file_id",
                "template_id",
                "status",
                "progress",
                "message",
                "stats",
                "formats",
                "rows",
                "created_at",
                "finished_at",
            },
        ),
        ("UploadOut", {"upload_id", "filename", "size", "chunk_size", "total_chunks", "received"}),
        ("Template", {"id", "name", "description", "version", "builtin", "rules", "columns", "options"}),
        ("RuleSpec", {"id", "name", "color", "enabled", "action", "match", "fields", "clears", "check"}),
        (
            "FieldSpec",
            {
                "key",
                "label",
                "start",
                "end",
                "group",
                "constant",
                "type",
                "decimal",
                "date_formats",
                "required",
                "default",
                "null_values",
                "trim",
                "target",
            },
        ),
        ("ColumnSpec", {"id", "header", "sources", "enabled", "width", "number_format", "total"}),
    ],
)
def test_component_schemas(spec, schema, fields):
    schemas = spec["components"]["schemas"]
    name = next((n for n in schemas if n == schema or n.startswith(f"{schema}-")), None)
    assert name, f"Falta el esquema {schema}"
    assert set(schemas[name]["properties"]) == fields


def test_rule_actions_enum(spec):
    schemas = spec["components"]["schemas"]
    name = next(n for n in schemas if n.startswith("RuleSpec"))
    assert set(schemas[name]["properties"]["action"]["enum"]) == {
        "row",
        "context",
        "row_context",
        "append",
        "check",
        "skip",
    }


def test_error_format(client):
    res = client.get("/api/v1/files/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    assert set(res.json()) == {"detail"} and isinstance(res.json()["detail"], str)
