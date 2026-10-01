"""RF-10 (acciones de regla), RF-16 (control de cuadre y errores) y resolución de columnas.
Técnica principal: tabla de decisión acción × efecto (fila / contexto / anexar / control / omitir)."""

from decimal import Decimal

import pytest

from app.core.extraction.base import Line
from app.core.mapping.engine import MappingEngine


def lines(*texts: str, page: int = 1) -> list[Line]:
    return [Line(page, i, t) for i, t in enumerate(texts, start=1)]


def rule(rid, action="row", value="", mtype="regex", fields=None, **extra):
    return {"id": rid, "action": action, "match": {"type": mtype, "value": value}, "fields": fields or [], **extra}


def col(cid, *sources, **extra):
    return {"id": cid, "header": cid.upper(), "sources": list(sources), **extra}


GRUPO = rule("grupo", "context", r"^G:(?P<g>\w+)", fields=[{"key": "g", "group": "g"}])
ITEM = rule("item", "row", r"^I ", fields=[{"key": "v", "start": 2, "end": 6, "type": "number"}])


@pytest.mark.req("RF-10")
def test_row_and_context_actions():
    eng = MappingEngine({"rules": [GRUPO, ITEM], "columns": [col("g", "grupo.g"), col("v", "item.v")]})
    rows = list(eng.process(lines("G:A", "I 10", "I 20", "G:B", "I 5", "basura")))
    assert rows == [["A", Decimal(10)], ["A", Decimal(20)], ["B", Decimal(5)]]
    stats = eng.finish_stats()
    assert stats["rows"] == 3 and stats["unmatched"] == 1
    assert stats["rule_hits"] == {"grupo": 2, "item": 3}


@pytest.mark.req("RF-10")
def test_context_carries_across_pages():
    eng = MappingEngine({"rules": [GRUPO, ITEM], "columns": [col("g", "grupo.g"), col("p", "@page")]})
    data = lines("G:A", "I 1") + lines("I 2", page=2)
    assert list(eng.process(data)) == [["A", 1], ["A", 2]]


@pytest.mark.req("RF-10")
def test_row_context_and_clears():
    factura = rule("factura", "row_context", r"^F", fields=[{"key": "doc", "start": 0, "end": 4}])
    pago = rule("pago", "row", r"^P", fields=[{"key": "doc", "start": 0, "end": 4}])
    cliente = rule("cliente", "context", r"^C", fields=[{"key": "c", "start": 2}], clears=["factura"])
    eng = MappingEngine(
        {
            "rules": [cliente, factura, pago],
            "columns": [col("cli", "cliente.c"), col("fac", "factura.doc"), col("doc", "factura.doc", "pago.doc")],
        }
    )
    rows = list(eng.process(lines("C X", "F001", "P001", "C Y", "P002")))
    assert rows == [
        ["X", "F001", "F001"],
        ["X", "F001", "P001"],
        ["Y", None, "P002"],  # el cliente nuevo borró la factura del contexto
    ]


@pytest.mark.req("RF-10")
def test_own_rule_source_has_priority_even_if_empty():
    """Si la fila la generó 'pago', su débito vacío no debe heredarse del contexto 'factura'."""
    factura = rule("factura", "row_context", r"^F", fields=[{"key": "deb", "start": 2, "end": 6, "type": "number"}])
    pago = rule("pago", "row", r"^P", fields=[{"key": "deb", "start": 2, "end": 6, "type": "number"}])
    eng = MappingEngine({"rules": [factura, pago], "columns": [col("deb", "factura.deb", "pago.deb")]})
    assert list(eng.process(lines("F 100", "P     "))) == [[Decimal(100)], [None]]


@pytest.mark.req("RF-10")
def test_append_concatenates_to_previous_row():
    item = rule("item", "row", r"^I", fields=[{"key": "d", "start": 2}])
    cont = rule("cont", "append", r"^\s+\.\.\.", fields=[{"key": "t", "start": 6, "target": "d"}])
    eng = MappingEngine({"rules": [item, cont], "columns": [col("d", "item.d")]})
    rows = list(eng.process(lines("I uno", "  ... dos", "  ... tres", "I cuatro")))
    assert rows == [["uno dos tres"], ["cuatro"]]


@pytest.mark.req("RF-10")
def test_append_without_previous_row_is_ignored():
    cont = rule("cont", "append", r"^x", fields=[{"key": "t", "start": 1}])
    eng = MappingEngine({"rules": [cont], "columns": [col("t", "cont.t")]})
    assert list(eng.process(lines("xhola"))) == []


@pytest.mark.req("RF-10")
def test_skip_rule_consumes_line():
    skip = rule("enc", "skip", r"^I HEADER")
    eng = MappingEngine({"rules": [skip, ITEM], "columns": [col("v", "item.v")]})
    assert list(eng.process(lines("I HEADER", "I 7"))) == [[Decimal(7)]]
    assert eng.finish_stats()["unmatched"] == 0


@pytest.mark.req("RF-10")
@pytest.mark.parametrize(
    ("mtype", "value", "ignore_case", "text", "matches"),
    [
        ("starts_with", "Total", False, "   Total: 5", True),
        ("starts_with", "total", True, "TOTAL: 5", True),
        ("starts_with", "total", False, "TOTAL: 5", False),
        ("contains", "->", False, "Sub-> 4", True),
        ("contains", "XX", False, "abc", False),
        ("always", "", False, "cualquier cosa", True),
        ("always", "", False, "    ", False),
        ("regex", r"^\d+$", False, "123", True),
    ],
)
def test_match_types(mtype, value, ignore_case, text, matches):
    r = {"id": "r", "action": "row", "match": {"type": mtype, "value": value, "ignore_case": ignore_case}, "fields": []}
    eng = MappingEngine({"rules": [r], "columns": [col("raw", "@raw")]})
    assert (len(list(eng.process(lines(text)))) == 1) is matches


@pytest.mark.req("RF-10")
def test_required_field_discriminates_rules():
    con_codigo = rule(
        "pedido",
        "row",
        r"^[A-Z]",
        fields=[{"key": "codigo", "start": 2, "end": 5, "required": True}, {"key": "tipo", "constant": "Pedido"}],
    )
    sin_codigo = rule("devolucion", "row", r"^[A-Z]", fields=[{"key": "tipo", "constant": "Devolución"}])
    eng = MappingEngine({"rules": [con_codigo, sin_codigo], "columns": [col("t", "pedido.tipo", "devolucion.tipo")]})
    assert list(eng.process(lines("P 001", "D    "))) == [["Pedido"], ["Devolución"]]


@pytest.mark.req("RF-10")
def test_first_matching_rule_wins_and_disabled_rules_are_ignored():
    a = rule("a", "row", "x", fields=[{"key": "k", "constant": "A"}])
    b = rule("b", "row", "x", fields=[{"key": "k", "constant": "B"}])
    eng = MappingEngine({"rules": [a, b], "columns": [col("k", "a.k", "b.k")]})
    assert list(eng.process(lines("x"))) == [["A"]]
    a_off = {**a, "enabled": False}
    eng = MappingEngine({"rules": [a_off, b], "columns": [col("k", "a.k", "b.k"), col("off", "b.k", enabled=False)]})
    assert list(eng.process(lines("x"))) == [["B"]]


@pytest.mark.req("RF-10")
def test_meta_sources():
    eng = MappingEngine(
        {"rules": [ITEM], "columns": [col("p", "@page"), col("l", "@line"), col("r", "@rule"), col("raw", "@raw")]}
    )
    assert list(eng.process([Line(3, 9, "I 1")])) == [[3, 9, "item", "I 1"]]


@pytest.mark.req("RF-16")
def test_conversion_errors_are_reported_without_aborting():
    eng = MappingEngine({"rules": [ITEM], "columns": [col("v", "item.v")]})
    rows = list(eng.process(lines("I 10", "I xx", "I 30")))
    assert rows == [[Decimal(10)], [None], [Decimal(30)]]
    stats = eng.finish_stats()
    assert stats["error_count"] == 1
    assert stats["errors"][0]["line"] == 2 and stats["errors"][0]["rule"] == "item"


def _check_template(tolerance="0"):
    total = rule(
        "total",
        "check",
        r"^T (?P<t>\S+)",
        fields=[{"key": "t", "group": "t", "type": "number"}],
        check={"group": "grupo", "compare": [{"field": "t", "sum_of": "v"}], "tolerance": tolerance},
    )
    return {"rules": [GRUPO, ITEM, total], "columns": [col("g", "grupo.g"), col("v", "item.v")]}


@pytest.mark.req("RF-16")
def test_check_ok_and_failed():
    eng = MappingEngine(_check_template())
    list(eng.process(lines("G:A", "I 10", "I 20", "T 30", "G:B", "I 5", "T 6")))
    stats = eng.finish_stats()
    assert stats["checks_ok"] == 1
    assert stats["checks_failed_count"] == 1
    assert "impreso 6 vs calculado 5" in stats["checks_failed"][0]["message"]


@pytest.mark.req("RF-16")
def test_check_tolerance():
    eng = MappingEngine(_check_template(tolerance="0.5"))
    list(eng.process(lines("G:A", "I 10", "T 10.4")))
    assert eng.finish_stats()["checks_ok"] == 1


@pytest.mark.req("RF-16")
def test_check_resets_when_group_changes():
    eng = MappingEngine(_check_template())
    list(eng.process(lines("G:A", "I 99", "G:B", "I 5", "T 5")))
    assert eng.finish_stats()["checks_ok"] == 1


@pytest.mark.req("RF-12")
def test_annotate_reports_rule_values_and_errors():
    eng = MappingEngine({"rules": [GRUPO, ITEM], "columns": []})
    result = [(ln.n, r.rule, r.values, r.errors) for ln, r in eng.annotate(lines("G:A", "I 1x", "otra"))]
    assert result[0] == (1, "grupo", {"g": "A"}, [])
    assert result[1][1] == "item" and result[1][3]
    assert result[2] == (3, None, {}, [])


@pytest.mark.req("RF-10")
def test_invalid_action_and_match_type():
    with pytest.raises(ValueError):
        MappingEngine({"rules": [rule("x", "explode", "a")], "columns": []})
    eng = MappingEngine({"rules": [rule("x", "row", "a", mtype="fuzzy")], "columns": []})
    with pytest.raises(ValueError):
        list(eng.process(lines("a")))


@pytest.mark.req("RF-16")
def test_errors_are_capped(monkeypatch):
    import app.core.mapping.engine as engine_module

    monkeypatch.setattr(engine_module, "MAX_ERRORS", 3)
    eng = MappingEngine({"rules": [ITEM], "columns": [col("v", "item.v")]})
    list(eng.process(lines(*["I zz"] * 10)))
    stats = eng.finish_stats()
    assert stats["error_count"] == 10 and len(stats["errors"]) == 3
