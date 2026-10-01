from __future__ import annotations

import csv
import re
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

_DANGEROUS = ("=", "+", "-", "@", "\t", "\r")
_NUMERIC = re.compile(r"^[-+]?[\d.,]+$")


class CsvExporter:
    """CSV UTF-8 con BOM (Excel lo abre con acentos correctos)."""

    def __init__(self, path: str | Path, columns: list[dict], delimiter: str = ";") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = self.path.open("w", newline="", encoding="utf-8-sig")
        self._writer = csv.writer(self._fh, delimiter=delimiter)
        self._writer.writerow([c["header"] for c in columns])
        self.total_rows = 0

    def write(self, row: list[Any]) -> None:
        self._writer.writerow([_fmt(v) for v in row])
        self.total_rows += 1

    def close(self) -> None:
        self._fh.close()


def _fmt(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, str) and value and value[0] in _DANGEROUS and not _NUMERIC.match(value):
        return "'" + value  # neutraliza fórmulas al abrir el CSV en Excel (OWASP CSV injection)
    return "" if value is None else value
