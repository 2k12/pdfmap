"""RF-04 · Reconstrucción de la cuadrícula de texto (función pura layout_chars) y extractor TXT."""

import pytest

from app.core.extraction.pdf import LayoutParams, layout_chars
from app.core.extraction.text import TextExtractor, read_text

pytestmark = pytest.mark.req("RF-04")
P = LayoutParams(char_width=5.0, x_origin=10.0, y_tolerance=2.0)


def ch(text, col, y):
    left = 10.0 + col * 5.0
    return (text, left, y, left + 5.0, y + 8)


def test_layout_groups_by_line_and_column():
    chars = [ch("B", 0, 100), ch("A", 0, 120), ch("C", 4, 120), ch("D", 2, 100.8)]
    assert layout_chars(chars, P) == ["A   C", "B D"]


def test_layout_tolerates_vertical_jitter_and_sorts_x():
    chars = [ch("c", 2, 50.5), ch("a", 0, 50), ch("b", 1, 49.2)]
    assert layout_chars(chars, P) == ["abc"]


def test_layout_collisions_never_lose_characters():
    chars = [("x", 10.0, 0, 13, 8), ("y", 11.0, 0, 14, 8), ("z", 12.0, 0, 15, 8)]
    assert layout_chars(chars, P) == ["xyz"]


def test_layout_negative_columns_clamped():
    assert layout_chars([("a", 0.0, 0, 5, 8)], P) == ["a"]


def test_layout_empty():
    assert layout_chars([], P) == []


def test_text_extractor_pages_and_tabs(tmp_path):
    path = tmp_path / "r.txt"
    path.write_bytes(b"uno\tdos\r\nlinea 2\n\n\fpagina dos\n")  # bytes: sin traducción de \n en Windows
    ex = TextExtractor(path)
    assert ex.page_count() == 2
    assert ex.page_lines(1) == ["uno     dos", "linea 2"]
    assert ex.page_lines(2) == ["pagina dos"]
    with pytest.raises(IndexError):
        ex.page_lines(3)
    ex.close()


def test_text_extractor_splits_long_pages(tmp_path):
    path = tmp_path / "largo.txt"
    path.write_text("\n".join(f"l{i}" for i in range(250)), encoding="utf-8")
    ex = TextExtractor(path, lines_per_page=100)
    assert ex.page_count() == 3
    assert ex.page_lines(3)[-1] == "l249"


@pytest.mark.parametrize("encoding", ["utf-8", "cp1252", "latin-1"])
def test_read_text_encodings(tmp_path, encoding):
    path = tmp_path / "enc.txt"
    path.write_bytes("Año Peña ÑANDÚ".encode(encoding))
    assert read_text(path) == "Año Peña ÑANDÚ"
