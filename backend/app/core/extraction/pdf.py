"""Extractor genérico de PDF con capa de texto.

No asume ningún formato de reporte: reconstruye cada página como una cuadrícula de caracteres
(ancho fijo) a partir de la posición de cada glifo. El ancho de carácter, el origen X y la
tolerancia vertical se calibran automáticamente con las primeras páginas, o se pueden forzar.
"""

from __future__ import annotations

import statistics
import threading
from dataclasses import asdict, dataclass

import pypdfium2 as pdfium

# pdfium no es thread-safe: todas las llamadas pasan por este candado.
PDFIUM_LOCK = threading.RLock()

Char = tuple[str, float, float, float, float]  # (carácter, izq, abajo, der, arriba)


@dataclass
class LayoutParams:
    char_width: float
    x_origin: float
    y_tolerance: float

    def to_dict(self) -> dict:
        return asdict(self)


class PdfExtractor:
    def __init__(
        self,
        path: str,
        char_width: float | None = None,
        x_origin: float | None = None,
        y_tolerance: float | None = None,
        calibration_pages: int = 5,
    ) -> None:
        with PDFIUM_LOCK:
            self._pdf = pdfium.PdfDocument(path)
        self._n_pages = len(self._pdf)
        if char_width is None or x_origin is None or y_tolerance is None:
            auto = self._calibrate(calibration_pages)
            char_width = char_width or auto.char_width
            x_origin = auto.x_origin if x_origin is None else x_origin
            y_tolerance = y_tolerance or auto.y_tolerance
        self.params = LayoutParams(char_width, x_origin, y_tolerance)

    # -- API pública -----------------------------------------------------------------------
    def page_count(self) -> int:
        return self._n_pages

    def page_lines(self, page: int) -> list[str]:
        if not 1 <= page <= self._n_pages:
            raise IndexError(f"Página fuera de rango: {page}")
        return layout_chars(self._chars(page - 1), self.params)

    def has_text(self, sample_pages: int = 3) -> bool:
        return any(self._chars(i) for i in range(min(sample_pages, self._n_pages)))

    def close(self) -> None:
        with PDFIUM_LOCK:
            self._pdf.close()

    def __enter__(self) -> PdfExtractor:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- Internos --------------------------------------------------------------------------
    def _chars(self, index: int) -> list[Char]:
        with PDFIUM_LOCK:
            page = self._pdf[index]
            textpage = page.get_textpage()
            try:
                count = textpage.count_chars()
                full = textpage.get_text_range(0, count) if count else ""
                if len(full) != count:  # mapeo índice→carácter no fiable: lectura uno a uno
                    full = None
                chars: list[Char] = []
                for i in range(count):
                    ch = full[i] if full is not None else textpage.get_text_range(i, 1)
                    if not ch or not ch.strip():
                        continue
                    left, bottom, right, top = textpage.get_charbox(i, loose=True)
                    chars.append((ch, left, bottom, right, top))
                return chars
            finally:
                textpage.close()
                page.close()

    def _calibrate(self, sample_pages: int) -> LayoutParams:
        widths: list[float] = []
        heights: list[float] = []
        lefts: list[float] = []
        for i in range(min(sample_pages, self._n_pages)):
            for _, left, bottom, right, top in self._chars(i):
                if right > left:
                    widths.append(right - left)
                if top > bottom:
                    heights.append(top - bottom)
                lefts.append(left)
        if not widths:
            return LayoutParams(char_width=5.0, x_origin=0.0, y_tolerance=2.0)
        return LayoutParams(
            char_width=round(statistics.median(widths), 3),
            x_origin=round(min(lefts), 3),
            y_tolerance=round(max(1.0, statistics.median(heights) * 0.3), 3),
        )


def layout_chars(chars: list[Char], params: LayoutParams) -> list[str]:
    """Agrupa glifos en líneas (por Y) y los coloca en columnas (por X). Función pura."""
    if not chars:
        return []
    ordered = sorted(chars, key=lambda c: (-c[2], c[1]))
    rows: list[list[Char]] = []
    current_y: float | None = None
    for ch in ordered:
        if current_y is None or abs(ch[2] - current_y) > params.y_tolerance:
            rows.append([])
            current_y = ch[2]
        rows[-1].append(ch)

    lines: list[str] = []
    for row in rows:
        cells: dict[int, str] = {}
        for text, left, *_ in sorted(row, key=lambda c: c[1]):
            col = max(0, round((left - params.x_origin) / params.char_width))
            while col in cells:  # fuentes proporcionales: nunca se pierde un carácter
                col += 1
            cells[col] = text
        buffer = [" "] * (max(cells) + 1)
        for col, text in cells.items():
            buffer[col] = text
        lines.append("".join(buffer).rstrip())
    return lines
