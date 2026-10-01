"""Plantillas de mapeo persistidas en SQLite. Las 'builtin' se cargan desde templates_builtin/."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from ..db import Database, now_iso
from ..schemas import Template
from .errors import Forbidden, NotFound

BUILTIN_DIR = Path(__file__).resolve().parent.parent / "templates_builtin"


class TemplateService:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.seed_builtins()

    def seed_builtins(self) -> None:
        for path in sorted(BUILTIN_DIR.glob("*.json")):
            tpl = Template.model_validate(json.loads(path.read_text(encoding="utf-8")))
            data = {**tpl.model_dump(mode="json"), "builtin": True}
            with self.db.connect() as conn:
                conn.execute(
                    "INSERT INTO templates (id, name, description, data, builtin, created_at, updated_at) "
                    "VALUES (?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, "
                    "description=excluded.description, data=excluded.data, updated_at=excluded.updated_at",
                    (tpl.id, tpl.name, tpl.description, json.dumps(data), now_iso(), now_iso()),
                )

    def list(self) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT id, name, description, builtin, updated_at FROM templates ORDER BY builtin DESC, name"
            ).fetchall()
        return [{**dict(r), "builtin": bool(r["builtin"])} for r in rows]

    def get(self, template_id: str) -> dict[str, Any]:
        with self.db.connect() as conn:
            row = conn.execute("SELECT data, builtin FROM templates WHERE id=?", (template_id,)).fetchone()
        if row is None:
            raise NotFound("Plantilla no encontrada")
        return {**json.loads(row["data"]), "builtin": bool(row["builtin"])}

    def _is_builtin(self, template_id: str) -> bool:
        with self.db.connect() as conn:
            row = conn.execute("SELECT builtin FROM templates WHERE id=?", (template_id,)).fetchone()
        if row is None:
            raise NotFound("Plantilla no encontrada")
        return bool(row["builtin"])

    def create(self, tpl: Template) -> dict[str, Any]:
        tpl = tpl.model_copy(update={"id": str(uuid.uuid4()), "builtin": False})
        data = tpl.model_dump(mode="json")
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO templates (id, name, description, data, builtin, created_at, updated_at) "
                "VALUES (?,?,?,?,0,?,?)",
                (tpl.id, tpl.name, tpl.description, json.dumps(data), now_iso(), now_iso()),
            )
        return data

    def update(self, template_id: str, tpl: Template) -> dict[str, Any]:
        if self._is_builtin(template_id):
            raise Forbidden("Las plantillas precargadas no se modifican; guarde una copia")
        tpl = tpl.model_copy(update={"id": template_id, "version": tpl.version + 1, "builtin": False})
        data = tpl.model_dump(mode="json")
        with self.db.connect() as conn:
            conn.execute(
                "UPDATE templates SET name=?, description=?, data=?, updated_at=? WHERE id=?",
                (tpl.name, tpl.description, json.dumps(data), now_iso(), template_id),
            )
        return data

    def delete(self, template_id: str) -> None:
        if self._is_builtin(template_id):
            raise Forbidden("Las plantillas precargadas no se eliminan")
        with self.db.connect() as conn:
            conn.execute("DELETE FROM templates WHERE id=?", (template_id,))
