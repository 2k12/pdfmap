"""Utilidades de seguridad de entrada: nombres de archivo, identificadores y firmas de archivo."""

from __future__ import annotations

import re
import unicodedata
import uuid
from pathlib import Path

from ..core.extraction import SUPPORTED_EXTENSIONS
from .errors import NotFound, Unsupported

_UNSAFE = re.compile(r"[^\w.\- ]+", re.UNICODE)


def safe_filename(name: str) -> str:
    """Nombre visible seguro: sin rutas, caracteres de control ni separadores."""
    name = unicodedata.normalize("NFC", name)
    name = name.replace("\\", "/").split("/")[-1]
    name = _UNSAFE.sub("_", name).strip(" .")
    return (name or "archivo")[:200]


def file_kind(name: str) -> str:
    ext = Path(name).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise Unsupported(f"Extensión no soportada: '{ext or '(sin extensión)'}'. Use PDF o TXT.")
    return SUPPORTED_EXTENSIONS[ext]


def check_signature(path: Path, kind: str) -> None:
    """Verifica la firma real del contenido (no confiar en la extensión)."""
    with path.open("rb") as fh:
        head = fh.read(1024)
    if kind == "pdf":
        if b"%PDF-" not in head[:1024]:
            raise Unsupported("El contenido no es un PDF válido (falta la firma %PDF-)")
    elif kind == "text" and b"\x00" in head:
        raise Unsupported("El archivo de texto contiene datos binarios")


def valid_uuid(value: str, what: str = "recurso") -> str:
    """Los ids se usan en rutas del disco: solo se aceptan UUID canónicos."""
    try:
        if str(uuid.UUID(value)) == value:
            return value
    except (ValueError, AttributeError, TypeError):
        pass
    raise NotFound(f"{what.capitalize()} no encontrado")
