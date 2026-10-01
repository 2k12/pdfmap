"""Contrato común de los extractores: convierten un documento en líneas de texto de ancho fijo."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Line:
    page: int
    n: int
    text: str


class Extractor(Protocol):
    def page_count(self) -> int: ...

    def page_lines(self, page: int) -> list[str]:
        """Líneas de la página `page` (1-based)."""
        ...

    def close(self) -> None: ...


def iter_lines(extractor: Extractor, start: int = 1, end: int | None = None) -> Iterator[Line]:
    last = extractor.page_count() if end is None else min(end, extractor.page_count())
    for page in range(start, last + 1):
        for n, text in enumerate(extractor.page_lines(page), start=1):
            yield Line(page, n, text)
