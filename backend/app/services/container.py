from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..db import Database
from .files import FileService
from .jobs import JobManager
from .mapping import MappingService
from .templates import TemplateService
from .uploads import UploadService


@dataclass
class Services:
    settings: Settings
    db: Database
    jobs: JobManager
    files: FileService
    uploads: UploadService
    templates: TemplateService
    mapping: MappingService

    @classmethod
    def build(cls, settings: Settings) -> Services:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        db = Database(settings.db_path)
        jobs = JobManager(db, settings.workers)
        files = FileService(settings, db, jobs)
        uploads = UploadService(settings, files)
        templates = TemplateService(db)
        mapping = MappingService(settings, db, files, templates, jobs)
        return cls(settings, db, jobs, files, uploads, templates, mapping)

    def close(self) -> None:
        self.jobs.shutdown()
