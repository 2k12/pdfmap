"""Subida por fragmentos reanudable: los fragmentos pueden llegar en cualquier orden y en
paralelo; cada uno se escribe en su posición del archivo final (sin reensamblar en memoria)."""

from __future__ import annotations

import json
import math
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from ..config import Settings
from .errors import Conflict, NotFound, ServiceError, TooLarge
from .files import FileService
from .security import file_kind, safe_filename, valid_uuid


class UploadService:
    def __init__(self, settings: Settings, files: FileService) -> None:
        self.settings = settings
        self.files = files
        self.root = settings.uploads_dir
        self.root.mkdir(parents=True, exist_ok=True)
        self.cleanup_stale()

    def _dir(self, upload_id: str) -> Path:
        valid_uuid(upload_id, "subida")
        path = self.root / upload_id
        if not (path / "meta.json").exists():
            raise NotFound("Subida no encontrada")
        return path

    def _meta(self, upload_id: str) -> dict[str, Any]:
        return json.loads((self._dir(upload_id) / "meta.json").read_text(encoding="utf-8"))

    def init(self, filename: str, size: int) -> dict[str, Any]:
        name = safe_filename(filename)
        file_kind(name)  # rechaza extensiones no soportadas antes de recibir datos
        if size > self.settings.max_upload_bytes:
            raise TooLarge(f"El archivo supera el máximo de {self.settings.max_upload_mb} MB")
        upload_id = str(uuid.uuid4())
        path = self.root / upload_id
        (path / "chunks").mkdir(parents=True)
        chunk_size = self.settings.chunk_size
        meta = {
            "upload_id": upload_id,
            "filename": name,
            "size": size,
            "chunk_size": chunk_size,
            "total_chunks": max(1, math.ceil(size / chunk_size)),
            "created": time.time(),
        }
        (path / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
        with (path / "data.part").open("wb") as fh:
            fh.truncate(size)
        return {**meta, "received": []}

    def status(self, upload_id: str) -> dict[str, Any]:
        meta = self._meta(upload_id)
        return {**meta, "received": self._received(upload_id)}

    def _received(self, upload_id: str) -> list[int]:
        return sorted(int(p.name) for p in (self._dir(upload_id) / "chunks").iterdir() if p.name.isdigit())

    def put_chunk(self, upload_id: str, index: int, data: bytes) -> dict[str, int]:
        meta = self._meta(upload_id)
        total = meta["total_chunks"]
        if not 0 <= index < total:
            raise ServiceError(f"Índice de fragmento fuera de rango (0..{total - 1})", 400)
        offset = index * meta["chunk_size"]
        expected = min(meta["chunk_size"], meta["size"] - offset)
        if len(data) != expected:
            raise ServiceError(
                f"Tamaño de fragmento inválido: se esperaban {expected} bytes y llegaron {len(data)}", 400
            )
        path = self._dir(upload_id)
        with (path / "data.part").open("r+b") as fh:
            fh.seek(offset)
            fh.write(data)
        (path / "chunks" / str(index)).touch()
        return {"received": len(self._received(upload_id)), "total_chunks": total}

    def complete(self, upload_id: str) -> dict[str, Any]:
        meta = self._meta(upload_id)
        received = self._received(upload_id)
        missing = sorted(set(range(meta["total_chunks"])) - set(received))
        if missing:
            preview = ", ".join(map(str, missing[:10]))
            raise Conflict(f"Faltan {len(missing)} fragmentos: {preview}{'…' if len(missing) > 10 else ''}")
        path = self._dir(upload_id)
        try:
            info = self.files.register(path / "data.part", meta["filename"], move=True)
        finally:
            shutil.rmtree(path, ignore_errors=True)
        return info

    def abort(self, upload_id: str) -> None:
        shutil.rmtree(self._dir(upload_id), ignore_errors=True)

    def cleanup_stale(self) -> int:
        limit = time.time() - self.settings.upload_ttl_hours * 3600
        removed = 0
        for path in self.root.iterdir():
            meta = path / "meta.json"
            try:
                created = json.loads(meta.read_text(encoding="utf-8"))["created"] if meta.exists() else 0
            except (ValueError, KeyError):
                created = 0
            if created < limit:
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        return removed
