from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse

from ...schemas import JobIn, JobOut
from ...services.container import Services
from ..deps import get_services

router = APIRouter(prefix="/jobs", tags=["trabajos"])

MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
}


def job_out(job: dict[str, Any]) -> dict[str, Any]:
    return {
        **{
            k: job[k]
            for k in (
                "id",
                "kind",
                "file_id",
                "template_id",
                "status",
                "progress",
                "message",
                "rows",
                "created_at",
                "finished_at",
            )
        },
        "stats": json.loads(job["stats"]) if job.get("stats") else None,
        "formats": json.loads(job["formats"] or "[]"),
    }


@router.post("", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def create_job(body: JobIn, s: Services = Depends(get_services)) -> dict:
    template = body.template.engine_dict() if body.template else None
    return job_out(s.mapping.start_export(body.file_id, body.template_id, template, list(body.formats)))


@router.get("", response_model=list[JobOut])
def list_jobs(file_id: str | None = None, s: Services = Depends(get_services)) -> list[dict]:
    return [job_out(j) for j in s.jobs.list(file_id=file_id, kind="export")]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, s: Services = Depends(get_services)) -> dict:
    return job_out(s.mapping.get_job(job_id))


@router.get("/{job_id}/rows")
def job_rows(
    job_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    s: Services = Depends(get_services),
) -> dict:
    return s.mapping.job_rows(job_id, offset, limit)


@router.get("/{job_id}/download")
def download(
    job_id: str, format: str = Query("xlsx", pattern="^(xlsx|csv)$"), s: Services = Depends(get_services)
) -> FileResponse:
    path = s.mapping.output_path(job_id, format)
    return FileResponse(path, media_type=MEDIA[format], filename=f"resultado-{job_id[:8]}.{format}")


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel(job_id: str, s: Services = Depends(get_services)) -> dict:
    s.mapping.get_job(job_id)
    s.jobs.cancel(job_id)
    return job_out(s.mapping.get_job(job_id))
