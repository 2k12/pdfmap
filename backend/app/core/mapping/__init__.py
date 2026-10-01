from .converters import ConversionError, convert, to_date, to_integer, to_number
from .engine import ACTIONS, META_SOURCES, MappingEngine
from .patterns import guess_type, suggest_columns, suggest_regex


def column_types(template: dict) -> dict[str, str]:
    """Tipo de dato de cada columna (el del primer campo fuente con tipo conocido)."""
    fields = {
        f"{r['id']}.{f['key']}": f.get("type", "text") for r in template.get("rules", []) for f in r.get("fields", [])
    }
    meta = {"@page": "integer", "@line": "integer", "@rule": "text", "@raw": "text"}
    out = {}
    for col in template.get("columns", []):
        types = [fields.get(s) or meta.get(s) for s in col.get("sources", [])]
        out[col["id"]] = next((t for t in types if t), "text")
    return out


__all__ = [
    "ACTIONS",
    "META_SOURCES",
    "ConversionError",
    "MappingEngine",
    "column_types",
    "convert",
    "guess_type",
    "suggest_columns",
    "suggest_regex",
    "to_date",
    "to_integer",
    "to_number",
]
