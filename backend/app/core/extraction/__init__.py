from pathlib import Path

from .base import Extractor, Line, iter_lines
from .pdf import LayoutParams, PdfExtractor, layout_chars
from .text import TextExtractor

SUPPORTED_EXTENSIONS = {".pdf": "pdf", ".txt": "text", ".prn": "text", ".lst": "text"}


def open_extractor(path: str | Path, kind: str, params: dict | None = None) -> Extractor:
    params = params or {}
    if kind == "pdf":
        return PdfExtractor(
            str(path),
            char_width=params.get("char_width"),
            x_origin=params.get("x_origin"),
            y_tolerance=params.get("y_tolerance"),
        )
    if kind == "text":
        return TextExtractor(path, lines_per_page=params.get("lines_per_page", 100))
    raise ValueError(f"Tipo de archivo no soportado: {kind}")


__all__ = [
    "SUPPORTED_EXTENSIONS",
    "Extractor",
    "LayoutParams",
    "Line",
    "PdfExtractor",
    "TextExtractor",
    "iter_lines",
    "layout_chars",
    "open_extractor",
]
