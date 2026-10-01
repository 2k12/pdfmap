from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

VERSION = "1.0.0"


class Settings(BaseSettings):
    """Configuración por variables de entorno con prefijo PDFMAP_ (o archivo .env)."""

    model_config = SettingsConfigDict(env_prefix="PDFMAP_", env_file=".env", extra="ignore")

    data_dir: Path = Path("data")
    max_upload_mb: int = 2048
    chunk_size_mb: int = 8
    api_key: str | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    workers: int = 2
    max_regex_length: int = 1000
    preview_max_pages: int = 50
    max_stored_rows: int = 2_000_000
    upload_ttl_hours: int = 24

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def chunk_size(self) -> int:
        return self.chunk_size_mb * 1024 * 1024

    @property
    def db_path(self) -> Path:
        return self.data_dir / "pdfmap.sqlite3"

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
