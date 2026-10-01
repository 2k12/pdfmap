"""Conversión de texto extraído a tipos de dato (número, entero, fecha, texto)."""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

AUTO_DATE_FORMATS = (
    "%d/%m/%Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%Y/%m/%d",
    "%y/%m/%d",
    "%d/%m/%y",
    "%d.%m.%Y",
    "%m/%d/%Y",
    "%d-%b-%Y",
    "%Y%m%d",
)
_CURRENCY = re.compile(r"[\s$€£¥]|USD|EUR", re.IGNORECASE)


class ConversionError(ValueError):
    pass


def to_number(text: str, decimal: str = ".") -> Decimal | None:
    raw = _CURRENCY.sub("", text or "")
    if not raw:
        return None
    negative = False
    if raw.startswith("(") and raw.endswith(")"):
        negative, raw = True, raw[1:-1]
    if raw.endswith("-"):
        negative, raw = True, raw[:-1]
    if raw.startswith("-"):
        negative, raw = not negative, raw[1:]
    if not raw:  # un "-" suelto suele significar "sin valor"
        return None
    thousands = "," if decimal == "." else "."
    raw = raw.replace(thousands, "").replace(decimal, ".")
    try:
        value = Decimal(raw)
    except InvalidOperation as exc:
        raise ConversionError(f"'{text}' no es un número") from exc
    if not value.is_finite():
        raise ConversionError(f"'{text}' no es un número finito")
    return -value if negative else value


def to_integer(text: str) -> int | None:
    value = to_number(text)
    if value is None:
        return None
    if value != value.to_integral_value():
        raise ConversionError(f"'{text}' no es un entero")
    return int(value)


def to_date(text: str, formats: list[str] | tuple[str, ...] | None = None) -> datetime | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for fmt in formats or AUTO_DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    raise ConversionError(f"'{text}' no coincide con los formatos de fecha {list(formats or ['auto'])}")


def convert(text: str | None, field: dict):
    """Convierte el texto de un campo según su definición (`type`, `decimal`, `date_formats`...)."""
    if text is None:
        return None
    value = text.strip() if field.get("trim", True) else text
    if value in field.get("null_values", ()):
        value = ""
    if value == "" and field.get("default") is not None:
        value = str(field["default"])
    kind = field.get("type", "text")
    if kind == "text":
        return value or None
    if kind == "number":
        return to_number(value, field.get("decimal", "."))
    if kind == "integer":
        return to_integer(value)
    if kind == "date":
        return to_date(value, field.get("date_formats") or None)
    raise ConversionError(f"Tipo desconocido: {kind}")
