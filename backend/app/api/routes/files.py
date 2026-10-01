from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request, Response, UploadFile, status

from ...schemas import ChunkOut, ExtractParams, FileOut, PageOut, SearchOut, UploadInit, UploadOut
from ...services.container import Services
from ...services.errors import ServiceError, TooLarge
from ..deps import get_services

router = APIRouter(tags=["archivos"])


# --- Subida por fragmentos -----------------------------------------------------------------
@router.post("/uploads", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
def init_upload(body: UploadInit, s: Services = Depends(get_services)) -> dict:
    return s.uploads.init(body.filename, body.size)


@router.get("/uploads/{upload_id}", response_model=UploadOut)
def upload_status(upload_id: str, s: Services = Depends(get_services)) -> dict:
    return s.uploads.status(upload_id)


@router.put("/uploads/{upload_id}/chunks/{index}", response_model=ChunkOut)
async def put_chunk(upload_id: str, index: int, request: Request, s: Services = Depends(get_services)) -> dict:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > s.settings.chunk_size:
        raise TooLarge("Fragmento mayor que chunk_size")
    data = bytearray()
    async for part in request.stream():
        data.extend(part)
        if len(data) > s.settings.chunk_size:
            raise TooLarge("Fragmento mayor que chunk_size")
    return s.uploads.put_chunk(upload_id, index, bytes(data))


@router.post("/uploads/{upload_id}/complete", response_model=FileOut, status_code=status.HTTP_201_CREATED)
def complete_upload(upload_id: str, s: Services = Depends(get_services)) -> dict:
    return s.uploads.complete(upload_id)


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def abort_upload(upload_id: str, s: Services = Depends(get_services)) -> Response:
    s.uploads.abort(upload_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Archivos --------------------------------------------------------------------------------
@router.post("/files", response_model=FileOut, status_code=status.HTTP_201_CREATED)
def upload_file(file: UploadFile, s: Services = Depends(get_services)) -> dict:
    """Subida simple (multipart) para archivos pequeños."""
    if not file.filename:
        raise ServiceError("Falta el nombre del archivo", 400)
    tmp_dir = Path(tempfile.mkdtemp(dir=s.settings.uploads_dir))
    tmp = tmp_dir / "data.part"
    try:
        written = 0
        with tmp.open("wb") as out:
            while block := file.file.read(1024 * 1024):
                written += len(block)
                if written > s.settings.max_upload_bytes:
                    raise TooLarge(f"El archivo supera el máximo de {s.settings.max_upload_mb} MB")
                out.write(block)
        if written == 0:
            raise ServiceError("El archivo está vacío", 400)
        return s.files.register(tmp, file.filename, move=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.get("/files", response_model=list[FileOut])
def list_files(s: Services = Depends(get_services)) -> list[dict]:
    return s.files.list()


@router.get("/files/{file_id}", response_model=FileOut)
def get_file(file_id: str, s: Services = Depends(get_services)) -> dict:
    return s.files.get(file_id)


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: str, s: Services = Depends(get_services)) -> Response:
    s.files.delete(file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/files/{file_id}/extract", response_model=FileOut, status_code=status.HTTP_202_ACCEPTED)
def reextract(file_id: str, params: ExtractParams | None = None, s: Services = Depends(get_services)) -> dict:
    s.files.start_extraction(file_id, (params or ExtractParams.model_validate({})).model_dump(exclude_none=True))
    return s.files.get(file_id)


@router.get("/files/{file_id}/pages/{page}", response_model=PageOut)
def get_page(file_id: str, page: int, s: Services = Depends(get_services)) -> dict:
    return s.files.page(file_id, page)


@router.get("/files/{file_id}/search", response_model=SearchOut)
def search(
    file_id: str,
    pattern: str = Query(min_length=1, max_length=1000),
    mode: str = Query("contains", pattern="^(contains|regex)$"),
    limit: int = Query(50, ge=1, le=500),
    s: Services = Depends(get_services),
) -> dict:
    return s.files.search(file_id, pattern, mode, limit)
