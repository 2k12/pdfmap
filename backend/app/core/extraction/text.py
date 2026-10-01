"""Extractor para reportes en texto plano (.txt / .prn): páginas separadas por salto de página."""

from __future__ import annotations

from pathlib import Path

ENCODINGS = ("utf-8-sig", "cp1252", "latin-1")


def read_text(path: str | Path) -> str:
    raw = Path(path).read_bytes()
    for encoding in ENCODINGS:
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")  # pragma: no cover - latin-1 nunca falla


class TextExtractor:
    def __init__(self, path: str | Path, lines_per_page: int = 100, tab_size: int = 8) -> None:
        content = read_text(path).replace("\r\n", "\n").replace("\r", "\n")
        pages = content.split("\f") if "\f" in content else [content]
        self._pages: list[list[str]] = []
        for page in pages:
            lines = [line.expandtabs(tab_size).rstrip() for line in page.split("\n")]
            while lines and not lines[-1]:
                lines.pop()
            # Páginas muy largas se trocean para que la UI pueda paginar.
            for i in range(0, max(len(lines), 1), lines_per_page):
                self._pages.append(lines[i : i + lines_per_page])
        self.params = {"lines_per_page": lines_per_page, "tab_size": tab_size}

    def page_count(self) -> int:
        return len(self._pages)

    def page_lines(self, page: int) -> list[str]:
        if not 1 <= page <= len(self._pages):
            raise IndexError(f"Página fuera de rango: {page}")
        return list(self._pages[page - 1])

    def close(self) -> None:
        self._pages = []
