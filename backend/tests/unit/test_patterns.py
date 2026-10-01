"""RF-07 (regex sugerida) y RF-08 (detección automática de columnas y tipos)."""

import re

import pytest

from app.core.mapping.patterns import guess_type, suggest_columns, suggest_regex

LINES = [
    "01/02/2026  F-000123  COMERCIAL ANDES S.A.           334    8,102.11",
    "04/06/2026  F-000124  MUEBLES ARTESANALES            299    9,731.60",
    "15/07/2026  F-000125  FARMACIA CENTRAL                 7      120.00",
]


@pytest.mark.req("RF-07")
@pytest.mark.parametrize(
    ("line", "tokens", "should_match", "should_not_match"),
    [
        (LINES[0], 1, LINES[2], "Vendedor: V001 ANA PEREZ"),
        (LINES[0], 2, LINES[1], "01/02/2026  NC-00012  DEVOLUCION"),
        ("000001 CLIENTE DEMO   Zona: X", 1, "123456 OTRO CLIENTE", "12345 CORTO"),
        ("Vendedor: V001 ANA PEREZ", 1, "Vendedor: V999 OTRO", "Cliente: V001"),
        ("                    Total->   1,234.00", 1, "   Total->  5.00", "Subtotal-> 5"),
    ],
)
def test_suggest_regex_matches_same_shape(line, tokens, should_match, should_not_match):
    rx = re.compile(suggest_regex(line, tokens))
    assert rx.search(line)
    assert rx.search(should_match)
    assert not rx.search(should_not_match)


@pytest.mark.req("RF-07")
def test_suggest_regex_blank_line():
    assert suggest_regex("   ") == r"^\s*$"


@pytest.mark.req("RF-08")
def test_suggest_columns_detects_segments_and_types():
    segments = suggest_columns(LINES, min_gap=2)
    assert [(s["start"], s["end"]) for s in segments] == [(0, 10), (12, 20), (22, 42), (53, 56), (60, None)]
    assert segments[0] == {"start": 0, "end": 10, "type": "date", "date_formats": ["%d/%m/%Y"]}
    assert segments[1]["type"] == "text"  # F-000123: código
    assert segments[3]["type"] == "integer"  # cantidad
    assert segments[4] == {"start": 60, "end": None, "type": "number", "decimal": "."}


@pytest.mark.req("RF-08")
def test_suggest_columns_min_gap_merges_words():
    lines = ["ANA PEREZ   100", "BEA LOPEZ   200"]
    assert [(s["start"], s["end"]) for s in suggest_columns(lines, min_gap=1)] == [(0, 3), (4, 9), (12, None)]
    merged = suggest_columns(lines, min_gap=2)
    assert [(s["start"], s["end"]) for s in merged] == [(0, 9), (12, None)]


@pytest.mark.req("RF-08")
def test_suggest_columns_empty():
    assert suggest_columns(["", "   "]) == []


@pytest.mark.req("RF-08", "RF-09")
@pytest.mark.parametrize(
    ("values", "expected"),
    [
        (["1", "22", "333"], {"type": "integer"}),
        (["1,234.50", "12.00", ".38"], {"type": "number", "decimal": "."}),
        (["1.234,50", "12,00"], {"type": "number", "decimal": ","}),
        (["05/12/2020", "31/01/2021"], {"type": "date", "date_formats": ["%d/%m/%Y"]}),
        (["ABC", "12"], {"type": "text"}),
        (["", ""], {"type": "text"}),
        (["000123", "004567"], {"type": "text"}),  # códigos con ceros: no son enteros
    ],
)
def test_guess_type(values, expected):
    assert guess_type(values) == expected
