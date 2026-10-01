"""RF-09 · Conversión de tipos. Técnicas: particiones de equivalencia, valores límite y
pruebas basadas en propiedades (hypothesis)."""

from datetime import datetime
from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.core.mapping.converters import ConversionError, convert, to_date, to_integer, to_number

pytestmark = pytest.mark.req("RF-09")


@pytest.mark.parametrize(
    ("text", "decimal", "expected"),
    [
        ("1,234.56", ".", Decimal("1234.56")),
        ("1.234,56", ",", Decimal("1234.56")),
        (".00", ".", Decimal("0.00")),
        ("63.27", ".", Decimal("63.27")),
        ("-15.50", ".", Decimal("-15.50")),
        ("15.50-", ".", Decimal("-15.50")),
        ("(15.50)", ".", Decimal("-15.50")),
        ("$ 1,000.00", ".", Decimal("1000.00")),
        ("€1.000,00", ",", Decimal("1000.00")),
        ("0", ".", Decimal("0")),
    ],
)
def test_to_number_valid(text, decimal, expected):
    assert to_number(text, decimal) == expected


@pytest.mark.parametrize("text", ["", "   ", "-", "$"])
def test_to_number_empty_is_none(text):
    assert to_number(text) is None


@pytest.mark.parametrize("text", ["abc", "12a", "1.2.3", "NaN", "Infinity"])
def test_to_number_invalid(text):
    with pytest.raises(ConversionError):
        to_number(text)


def test_to_integer():
    assert to_integer("2,180") == 2180
    assert to_integer("") is None
    with pytest.raises(ConversionError):
        to_integer("12.5")


@pytest.mark.parametrize(
    ("text", "formats", "expected"),
    [
        ("20/12/05", ["%y/%m/%d"], datetime(2020, 12, 5)),
        ("05/12/2020", ["%d/%m/%Y"], datetime(2020, 12, 5)),
        ("2020-12-05", None, datetime(2020, 12, 5)),
        ("29/02/2024", None, datetime(2024, 2, 29)),
    ],
)
def test_to_date_valid(text, formats, expected):
    assert to_date(text, formats) == expected


@pytest.mark.parametrize("text", ["31/02/2024", "2024/13/01", "hola"])
def test_to_date_invalid(text):
    with pytest.raises(ConversionError):
        to_date(text, ["%d/%m/%Y"] if "/" in text and len(text) == 10 and text[2] == "/" else None)


def test_to_date_empty():
    assert to_date("  ") is None


def test_convert_text_trim_and_empty():
    assert convert("  hola  ", {"type": "text"}) == "hola"
    assert convert("   ", {"type": "text"}) is None
    assert convert("  x ", {"type": "text", "trim": False}) == "  x "
    assert convert(None, {"type": "number"}) is None


def test_convert_null_values_and_default():
    field = {"type": "text", "null_values": ["N/D"]}
    assert convert(" N/D ", field) is None
    assert convert("", {"type": "number", "default": "0"}) == Decimal("0")


def test_convert_unknown_type():
    with pytest.raises(ConversionError):
        convert("x", {"type": "binario"})


@given(st.decimals(min_value=-(10**9), max_value=10**9, places=2, allow_nan=False, allow_infinity=False))
def test_property_number_roundtrip_dot(value):
    """Cualquier importe formateado con separador de miles se recupera exacto."""
    assert to_number(f"{value:,.2f}") == value


@given(st.decimals(min_value=0, max_value=10**9, places=2, allow_nan=False, allow_infinity=False))
def test_property_number_roundtrip_comma(value):
    text = f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    assert to_number(text, ",") == value
