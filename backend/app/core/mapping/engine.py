"""Motor de mapeo genérico: aplica una plantilla (reglas + columnas) a un flujo de líneas.

Conceptos (ver docs/architecture/template-model.md):

* **Regla**: reconoce un tipo de línea (`match`) y extrae campos (por posición de columna o
  por grupo con nombre de una regex). Su `action` decide qué hace con la línea:
    - ``row``          emite una fila del Excel.
    - ``context``      guarda sus campos como contexto para las filas siguientes (p. ej. cliente).
    - ``row_context``  ambas cosas.
    - ``append``       concatena sus campos de texto a la fila anterior (líneas continuadas).
    - ``check``        valida totales impresos contra la suma de columnas (control de cuadre).
    - ``skip``         consume la línea sin hacer nada (encabezados, pies de página).
* **Columna**: una columna del Excel; toma el primer valor no nulo de sus `sources`
  (``regla.campo`` o metadatos ``@page``, ``@line``, ``@rule``, ``@raw``). Si alguna fuente
  pertenece a la regla que generó la fila, se usa esa fuente aunque esté vacía.

El motor es puro (sin E/S) y procesa en streaming, por lo que sirve para archivos enormes.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from ..extraction.base import Line
from .converters import ConversionError, convert

ACTIONS = {"row", "context", "row_context", "append", "check", "skip"}
META_SOURCES = {"@page", "@line", "@rule", "@raw"}
MAX_ERRORS = 500


@dataclass
class Issue:
    page: int
    line: int
    rule: str
    message: str

    def to_dict(self) -> dict:
        return {"page": self.page, "line": self.line, "rule": self.rule, "message": self.message}


@dataclass
class Stats:
    lines: int = 0
    rows: int = 0
    unmatched: int = 0
    rule_hits: dict[str, int] = field(default_factory=dict)
    errors: list[Issue] = field(default_factory=list)
    error_count: int = 0
    checks_ok: int = 0
    checks_failed: list[Issue] = field(default_factory=list)
    checks_failed_count: int = 0

    def add_error(self, issue: Issue) -> None:
        self.error_count += 1
        if len(self.errors) < MAX_ERRORS:
            self.errors.append(issue)

    def add_check_failure(self, issue: Issue) -> None:
        self.checks_failed_count += 1
        if len(self.checks_failed) < MAX_ERRORS:
            self.checks_failed.append(issue)

    def to_dict(self) -> dict:
        return {
            "lines": self.lines,
            "rows": self.rows,
            "unmatched": self.unmatched,
            "rule_hits": dict(self.rule_hits),
            "error_count": self.error_count,
            "errors": [e.to_dict() for e in self.errors],
            "checks_ok": self.checks_ok,
            "checks_failed_count": self.checks_failed_count,
            "checks_failed": [e.to_dict() for e in self.checks_failed],
        }


@dataclass
class LineResult:
    """Resultado de evaluar una línea (lo usa la vista de anotación del mapeador visual)."""

    rule: str | None
    values: dict[str, Any]
    errors: list[str]


class CompiledRule:
    def __init__(self, spec: dict) -> None:
        self.id: str = spec["id"]
        self.action: str = spec.get("action", "row")
        if self.action not in ACTIONS:
            raise ValueError(f"Regla '{self.id}': acción inválida '{self.action}'")
        self.fields: list[dict] = spec.get("fields", [])
        self.clears: list[str] = spec.get("clears", [])
        self.check: dict = spec.get("check") or {}
        match = spec.get("match") or {}
        self.match_type: str = match.get("type", "regex")
        self.match_value: str = match.get("value", "")
        self.ignore_case: bool = bool(match.get("ignore_case", False))
        flags = re.IGNORECASE if self.ignore_case else 0
        self.regex = re.compile(self.match_value, flags) if self.match_type == "regex" else None
        self.required = [f["key"] for f in self.fields if f.get("required")]

    def match(self, text: str) -> re.Match | bool | None:
        if self.match_type == "regex":
            return self.regex.search(text)  # type: ignore[union-attr]
        haystack, needle = (text.lower(), self.match_value.lower()) if self.ignore_case else (text, self.match_value)
        if self.match_type == "starts_with":
            return haystack.lstrip().startswith(needle)
        if self.match_type == "contains":
            return needle in haystack
        if self.match_type == "always":
            return bool(text.strip())
        raise ValueError(f"Regla '{self.id}': tipo de match inválido '{self.match_type}'")

    def raw_values(self, text: str, m: re.Match | bool | None) -> dict[str, str | None]:
        groups = m.groupdict() if isinstance(m, re.Match) else {}
        out: dict[str, str | None] = {}
        for f in self.fields:
            if "constant" in f and f["constant"] is not None:
                out[f["key"]] = str(f["constant"])
            elif f.get("group"):
                out[f["key"]] = groups.get(f["group"])
            else:
                start = int(f.get("start") or 0)
                end = f.get("end")
                out[f["key"]] = text[start:end] if end is not None else text[start:]
        return out


class MappingEngine:
    def __init__(self, template: dict) -> None:
        self.template = template
        self.rules = [CompiledRule(r) for r in template.get("rules", []) if r.get("enabled", True)]
        self.rules_by_id = {r.id: r for r in self.rules}
        self.columns: list[dict] = [c for c in template.get("columns", []) if c.get("enabled", True)]
        self.column_index = {c["id"]: i for i, c in enumerate(self.columns)}
        self.stats = Stats()
        self._context: dict[str, dict[str, Any]] = {}
        self._pending: dict[str, Any] | None = None
        self._sums: dict[str, dict[str, Decimal]] = {}  # grupo -> columna -> suma

    # -- Evaluación de una línea --------------------------------------------------------------
    def evaluate(self, line: Line) -> tuple[CompiledRule | None, dict[str, Any], list[str]]:
        for rule in self.rules:
            m = rule.match(line.text)
            if not m:
                continue
            raw = rule.raw_values(line.text, m)
            if any(not (raw.get(k) or "").strip() for k in rule.required):
                continue  # campo obligatorio vacío: la línea no es de esta regla
            values: dict[str, Any] = {}
            errors: list[str] = []
            for f in rule.fields:
                try:
                    values[f["key"]] = convert(raw.get(f["key"]), f)
                except ConversionError as exc:
                    values[f["key"]] = None
                    errors.append(f"{f['key']}: {exc}")
            return rule, values, errors
        return None, {}, []

    def annotate(self, lines: Iterable[Line]) -> Iterator[tuple[Line, LineResult]]:
        for line in lines:
            rule, values, errors = self.evaluate(line)
            yield line, LineResult(rule.id if rule else None, values, errors)

    # -- Procesamiento en streaming -------------------------------------------------------------
    def process(self, lines: Iterable[Line]) -> Iterator[list[Any]]:
        """Genera filas (lista de valores en el orden de `columns`)."""
        for line in lines:
            self.stats.lines += 1
            rule, values, errors = self.evaluate(line)
            if rule is None:
                self.stats.unmatched += 1
                continue
            self.stats.rule_hits[rule.id] = self.stats.rule_hits.get(rule.id, 0) + 1
            for err in errors:
                self.stats.add_error(Issue(line.page, line.n, rule.id, err))

            if rule.action == "skip":
                continue
            if rule.action == "append":
                self._append(rule, values)
                continue
            if rule.action == "check":
                yield from self._flush()
                self._run_check(rule, values, line)
                continue
            if rule.action in ("context", "row_context"):
                yield from self._flush()
                for cleared in rule.clears:
                    self._context.pop(cleared, None)
                self._context[rule.id] = values
                for group in list(self._sums):
                    if group == rule.id or group in rule.clears:
                        self._sums[group] = {}
            if rule.action in ("row", "row_context"):
                yield from self._flush()
                self._pending = {
                    "rule": rule.id,
                    "own": values,
                    "context": {rid: dict(v) for rid, v in self._context.items()},
                    "line": line,
                }
        yield from self._flush()

    def finish_stats(self) -> dict:
        return self.stats.to_dict()

    # -- Internos ----------------------------------------------------------------------------
    def _append(self, rule: CompiledRule, values: dict[str, Any]) -> None:
        if self._pending is None:
            return
        own = self._pending["own"]
        for f in rule.fields:
            target = f.get("target") or f["key"]
            extra = values.get(f["key"])
            if extra in (None, ""):
                continue
            current = own.get(target)
            own[target] = f"{current} {extra}" if current not in (None, "") else extra

    def _resolve(self, pending: dict) -> list[Any]:
        rule_id, own, context, line = pending["rule"], pending["own"], pending["context"], pending["line"]
        row: list[Any] = []
        for col in self.columns:
            sources: list[str] = col.get("sources", [])
            value = None
            own_sources = [s for s in sources if s.split(".", 1)[0] == rule_id]
            if own_sources:
                value = next(
                    (own.get(s.split(".", 1)[1]) for s in own_sources if own.get(s.split(".", 1)[1]) is not None), None
                )
            else:
                for src in sources:
                    value = self._meta(src, rule_id, line) if src in META_SOURCES else self._from_context(src, context)
                    if value is not None:
                        break
            row.append(value)
        return row

    @staticmethod
    def _meta(src: str, rule_id: str, line: Line) -> Any:
        return {"@page": line.page, "@line": line.n, "@rule": rule_id, "@raw": line.text}[src]

    @staticmethod
    def _from_context(src: str, context: dict[str, dict[str, Any]]) -> Any:
        rule_id, _, key = src.partition(".")
        return context.get(rule_id, {}).get(key)

    def _flush(self) -> Iterator[list[Any]]:
        if self._pending is None:
            return
        row = self._resolve(self._pending)
        self._pending = None
        self.stats.rows += 1
        self._accumulate(row)
        yield row

    def _accumulate(self, row: list[Any]) -> None:
        for rule in self.rules:
            if rule.action != "check":
                continue
            group = rule.check.get("group", "")
            sums = self._sums.setdefault(group, {})
            for cmp in rule.check.get("compare", []):
                idx = self.column_index.get(cmp.get("sum_of", ""))
                if idx is None:
                    continue
                value = row[idx]
                if isinstance(value, (int, Decimal)):
                    sums[cmp["sum_of"]] = sums.get(cmp["sum_of"], Decimal(0)) + Decimal(value)

    def _run_check(self, rule: CompiledRule, values: dict[str, Any], line: Line) -> None:
        group = rule.check.get("group", "")
        sums = self._sums.get(group, {})
        tolerance = Decimal(str(rule.check.get("tolerance", "0")))
        problems = []
        for cmp in rule.check.get("compare", []):
            expected = values.get(cmp["field"])
            if expected is None:
                continue
            actual = sums.get(cmp["sum_of"], Decimal(0))
            if abs(Decimal(expected) - actual) > tolerance:
                problems.append(f"{cmp['field']}: impreso {expected} vs calculado {actual}")
        if problems:
            self.stats.add_check_failure(Issue(line.page, line.n, rule.id, "; ".join(problems)))
        else:
            self.stats.checks_ok += 1
        if rule.check.get("reset", True):
            self._sums[group] = {}
