"""Persistencia en SQLite (modo WAL). Una conexión por operación: seguro entre hilos."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    kind TEXT NOT NULL,
    sha256 TEXT,
    status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    pages INTEGER,
    lines INTEGER,
    error TEXT,
    extraction TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lines (
    file_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    n INTEGER NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (file_id, page, n)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    data TEXT NOT NULL,
    builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    file_id TEXT NOT NULL,
    template_id TEXT,
    template TEXT,
    formats TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    stats TEXT,
    columns TEXT,
    rows INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_jobs_file ON jobs(file_id);
CREATE TABLE IF NOT EXISTS job_rows (
    job_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (job_id, idx)
) WITHOUT ROWID;
"""


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
