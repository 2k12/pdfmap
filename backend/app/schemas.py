"""Modelos de entrada/salida de la API y validación de plantillas."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .core.mapping import META_SOURCES

IDENT = r"^[a-z][a-z0-9_]{0,39}$"
COLOR = r"^#[0-9a-fA-F]{6}$"
MAX_REGEX = 1000


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Plantillas ----------------------------------------------------------------------------
class Match(_Base):
    type: Literal["regex", "starts_with", "contains", "always"] = "regex"
    value: str = Field("", max_length=MAX_REGEX)
    ignore_case: bool = False

    @model_validator(mode="after")
    def _check(self) -> Match:
        if self.type == "regex":
            try:
                re.compile(self.value)
            except re.error as exc:
                raise ValueError(f"Regex inválida: {exc}") from exc
        elif self.type != "always" and not self.value:
            raise ValueError("El valor de coincidencia no puede estar vacío")
        return self


class FieldSpec(_Base):
    key: str = Field(pattern=IDENT)
    label: str = Field("", max_length=100)
    start: int | None = Field(None, ge=0, le=10_000)
    end: int | None = Field(None, ge=1, le=10_000)
    group: str | None = Field(None, max_length=40)
    constant: str | None = Field(None, max_length=500)
    type: Literal["text", "number", "integer", "date"] = "text"
    decimal: Literal[".", ","] = "."
    date_formats: list[str] = Field(default_factory=list, max_length=10)
    required: bool = False
    default: str | None = Field(None, max_length=100)
    null_values: list[str] = Field(default_factory=list, max_length=20)
    trim: bool = True
    target: str | None = Field(None, pattern=IDENT)

    @model_validator(mode="after")
    def _check(self) -> FieldSpec:
        if self.start is not None and self.end is not None and self.end <= self.start:
            raise ValueError(f"Campo '{self.key}': end debe ser mayor que start")
        return self


class CompareSpec(_Base):
    field: str = Field(pattern=IDENT)
    sum_of: str = Field(min_length=1, max_length=60)


class CheckSpec(_Base):
    group: str = Field("", max_length=40)
    compare: list[CompareSpec] = Field(default_factory=list, max_length=20)
    tolerance: str = "0"
    reset: bool = True


class RuleSpec(_Base):
    id: str = Field(pattern=IDENT)
    name: str = Field("", max_length=100)
    color: str | None = Field(None, pattern=COLOR)
    enabled: bool = True
    action: Literal["row", "context", "row_context", "append", "check", "skip"] = "row"
    match: Match
    fields: list[FieldSpec] = Field(default_factory=list, max_length=100)
    clears: list[str] = Field(default_factory=list, max_length=50)
    check: CheckSpec | None = None

    @model_validator(mode="after")
    def _check(self) -> RuleSpec:
        keys = [f.key for f in self.fields]
        dup = {k for k in keys if keys.count(k) > 1}
        if dup:
            raise ValueError(f"Regla '{self.id}': campos duplicados {sorted(dup)}")
        groups = set(re.compile(self.match.value).groupindex) if self.match.type == "regex" else set()
        for f in self.fields:
            if f.group and f.group not in groups:
                raise ValueError(f"Regla '{self.id}': el grupo '{f.group}' no existe en la regex")
        if self.action == "check":
            if not self.check:
                raise ValueError(f"Regla '{self.id}': action=check requiere 'check'")
            for cmp in self.check.compare:
                if cmp.field not in keys:
                    raise ValueError(f"Regla '{self.id}': el campo '{cmp.field}' de check no existe")
        return self


class ColumnSpec(_Base):
    id: str = Field(pattern=IDENT)
    header: str = Field(min_length=1, max_length=255)
    sources: list[str] = Field(default_factory=list, max_length=20)
    enabled: bool = True
    width: float | None = Field(None, gt=0, le=255)
    number_format: str | None = Field(None, max_length=100)
    total: bool = False


class TemplateOptions(_Base):
    sheet_name: str = Field("Datos", min_length=1, max_length=31)
    totals_row: bool = True
    freeze_header: bool = True
    autofilter: bool = True
    header_color: str = Field("1F4E78", pattern=r"^[0-9a-fA-F]{6}$")
    csv_delimiter: Literal[";", ",", "\t", "|"] = ";"

    @field_validator("sheet_name")
    @classmethod
    def _sheet(cls, v: str) -> str:
        if re.search(r"[\[\]:*?/\\]", v):
            raise ValueError("El nombre de hoja no puede contener []:*?/\\")
        return v


class Template(_Base):
    id: str | None = Field(None, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field("", max_length=2000)
    version: int = 1
    builtin: bool = False  # solo informativo: el servidor lo calcula e ignora el valor recibido
    rules: list[RuleSpec] = Field(default_factory=list, max_length=100)
    columns: list[ColumnSpec] = Field(default_factory=list, max_length=500)
    options: TemplateOptions = Field(default_factory=lambda: TemplateOptions.model_validate({}))

    @model_validator(mode="after")
    def _check(self) -> Template:
        rule_ids = [r.id for r in self.rules]
        if len(rule_ids) != len(set(rule_ids)):
            raise ValueError("Hay reglas con id duplicado")
        col_ids = [c.id for c in self.columns]
        if len(col_ids) != len(set(col_ids)):
            raise ValueError("Hay columnas con id duplicado")
        fields = {f"{r.id}.{f.key}" for r in self.rules for f in r.fields}
        for col in self.columns:
            for src in col.sources:
                if src not in fields and src not in META_SOURCES:
                    raise ValueError(f"Columna '{col.id}': fuente desconocida '{src}'")
        for rule in self.rules:
            for cleared in rule.clears:
                if cleared not in rule_ids:
                    raise ValueError(f"Regla '{rule.id}': clears referencia una regla inexistente '{cleared}'")
            if rule.check:
                if rule.check.group and rule.check.group not in rule_ids:
                    raise ValueError(f"Regla '{rule.id}': grupo de check inexistente '{rule.check.group}'")
                for cmp in rule.check.compare:
                    if cmp.sum_of not in col_ids:
                        raise ValueError(f"Regla '{rule.id}': sum_of referencia una columna inexistente '{cmp.sum_of}'")
        return self

    def engine_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="python")


class TemplateSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    builtin: bool = False
    updated_at: str


# --- Archivos y subidas --------------------------------------------------------------------
class UploadInit(_Base):
    filename: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0)


class UploadOut(BaseModel):
    upload_id: str
    filename: str
    size: int
    chunk_size: int
    total_chunks: int
    received: list[int] = []


class ChunkOut(BaseModel):
    received: int
    total_chunks: int


class FileOut(BaseModel):
    id: str
    name: str
    size: int
    kind: str
    status: str
    progress: float
    pages: int | None
    lines: int | None
    error: str | None
    created_at: str
    extraction: dict[str, Any] | None = None


class ExtractParams(_Base):
    char_width: float | None = Field(None, gt=0, le=100)
    x_origin: float | None = Field(None, ge=-1000, le=10_000)
    y_tolerance: float | None = Field(None, gt=0, le=100)


class LineOut(BaseModel):
    n: int
    text: str


class PageOut(BaseModel):
    page: int
    pages: int
    lines: list[LineOut]


class SearchMatch(BaseModel):
    page: int
    n: int
    text: str


class SearchOut(BaseModel):
    matches: list[SearchMatch]
    truncated: bool


# --- Mapeo ---------------------------------------------------------------------------------
class SuggestRegexIn(_Base):
    line: str = Field(max_length=5000)
    tokens: int = Field(1, ge=1, le=10)


class SuggestColumnsIn(_Base):
    lines: list[str] = Field(min_length=1, max_length=2000)
    min_gap: int = Field(1, ge=1, le=20)


class ValidateIn(BaseModel):
    template: dict[str, Any]


class ValidateOut(BaseModel):
    valid: bool
    errors: list[str]


class AnnotateIn(_Base):
    file_id: str
    template: Template
    page: int = Field(ge=1)


class PreviewIn(_Base):
    file_id: str
    template: Template
    max_pages: int = Field(20, ge=1, le=500)
    start_page: int = Field(1, ge=1)
    limit: int = Field(200, ge=1, le=5000)


# --- Trabajos ------------------------------------------------------------------------------
class JobIn(_Base):
    file_id: str
    template_id: str | None = None
    template: Template | None = None
    formats: list[Literal["xlsx", "csv"]] = Field(default_factory=lambda: ["xlsx"], min_length=1)  # type: ignore[arg-type]

    @model_validator(mode="after")
    def _check(self) -> JobIn:
        if (self.template_id is None) == (self.template is None):
            raise ValueError("Indique exactamente uno de 'template_id' o 'template'")
        return self


class JobOut(BaseModel):
    id: str
    kind: str
    file_id: str
    template_id: str | None
    status: str
    progress: float
    message: str
    stats: dict[str, Any] | None
    formats: list[str]
    rows: int
    created_at: str
    finished_at: str | None
