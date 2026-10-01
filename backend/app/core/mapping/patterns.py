"""Heurísticas que asisten al mapeo visual: sugerir la regex de una línea, detectar columnas
por espacios en blanco y adivinar el tipo de dato de un campo."""

from __future__ import annotations

import re

from .converters import AUTO_DATE_FORMATS, ConversionError, to_date, to_number

_RUN = re.compile(r"[A-Z]+|[a-z]+|\d+|\s+|.", re.UNICODE)
_NUMBER = re.compile(r"^[-(]?[$€]?\s*[\d.,]*\d[\d.,]*\s*[-)]?$")


def _shape(token: str) -> str:
    parts = []
    for run in _RUN.findall(token):
        if run.isdigit():
            parts.append(rf"\d{{{len(run)}}}" if len(run) > 1 else r"\d")
        elif run.isspace():
            parts.append(r"\s+")
        elif run.isalpha() and run.isupper():
            parts.append(rf"[A-Z]{{{len(run)}}}" if len(run) > 1 else "[A-Z]")
        elif run.isalpha():
            parts.append(re.escape(run))
        else:
            parts.append(re.escape(run))
    return "".join(parts)


def suggest_regex(line: str, tokens: int = 1) -> str:
    """Regex que reconoce líneas con la misma "forma" inicial que `line`.

    Ej.: ``"01/02/2026  F-000123"`` → ``^\\d{2}/\\d{2}/\\d{4}\\s+[A-Z]\\-\\d{6}`` con tokens=2.
    Las palabras con letras se mantienen literales si son etiquetas (contienen ':' o '->').
    """
    stripped = line.lstrip()
    indent = len(line) - len(stripped)
    words = stripped.split()
    if not words:
        return r"^\s*$"
    prefix = r"^\s*" if indent else "^"
    pieces = []
    for word in words[: max(1, tokens)]:
        if (
            any(mark in word for mark in (":", "->"))
            or (word.isalpha() and not word.isupper())
            or (word.isalpha() and len(word) > 3)
        ):
            pieces.append(re.escape(word))
        else:
            pieces.append(_shape(word))
    return prefix + r"\s+".join(pieces)


def suggest_columns(lines: list[str], min_gap: int = 1) -> list[dict]:
    """Detecta segmentos de columnas ocupados en todas las líneas dadas, separados por
    columnas que están en blanco en *todas* ellas."""
    lines = [ln for ln in lines if ln.strip()]
    if not lines:
        return []
    width = max(len(ln) for ln in lines)
    occupied = [False] * width
    for ln in lines:
        for i, ch in enumerate(ln):
            if ch != " ":
                occupied[i] = True
    runs: list[list[int]] = []
    for i, occ in enumerate(occupied):
        if not occ:
            continue
        if runs and i - runs[-1][1] < min_gap:
            runs[-1][1] = i + 1  # contiguo o hueco menor que min_gap: mismo segmento
        else:
            runs.append([i, i + 1])
    segments: list[dict] = []
    for start, end in runs:
        values = [ln[start:end].strip() for ln in lines]
        segments.append({"start": start, "end": end, **guess_type(values)})
    # El último segmento llega hasta el final de la línea (texto libre de largo variable).
    if segments:
        segments[-1]["end"] = None
    return segments


def guess_type(values: list[str]) -> dict:
    sample = [v for v in values if v]
    if not sample:
        return {"type": "text"}
    if all(re.fullmatch(r"-?\d+", v) for v in sample):
        # Códigos (ceros a la izquierda o 6+ dígitos) se dejan como texto para no perder ceros.
        if any(len(v) > 1 and v[0] == "0" for v in sample) or all(len(v) >= 6 for v in sample):
            return {"type": "text"}
        return {"type": "integer"}
    for fmt in AUTO_DATE_FORMATS:
        if fmt == "%Y%m%d" and not all(len(v) == 8 and v.isdigit() for v in sample):
            continue  # sin separadores solo se acepta AAAAMMDD exacto
        try:
            for v in sample:
                to_date(v, [fmt])
            return {"type": "date", "date_formats": [fmt]}
        except ConversionError:
            continue
    if all(_NUMBER.match(v) for v in sample):
        decimal = _guess_decimal(sample)
        try:
            for v in sample:
                to_number(v, decimal)
            return {"type": "number", "decimal": decimal}
        except ConversionError:
            pass
    return {"type": "text"}


def _guess_decimal(sample: list[str]) -> str:
    comma_dec = sum(bool(re.search(r",\d{1,2}[-)]?$", v)) for v in sample)
    dot_dec = sum(bool(re.search(r"\.\d{1,2}[-)]?$", v)) for v in sample)
    return "," if comma_dec > dot_dec else "."
