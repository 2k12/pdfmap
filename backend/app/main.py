"""Aplicación FastAPI de PDFMap: mapeo visual de reportes PDF/TXT a Excel."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.deps import require_api_key
from .api.routes import files, jobs, mapping, templates
from .config import VERSION, Settings, get_settings
from .services.container import Services
from .services.errors import ServiceError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.services = Services.build(settings)
        try:
            yield
        finally:
            app.state.services.close()

    app = FastAPI(
        title="PDFMap API",
        version=VERSION,
        description=(
            "Carga de reportes PDF/TXT de formato desconocido, mapeo visual mediante plantillas "
            "y exportación a Excel/CSV."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-API-Key"],
    )

    @app.exception_handler(ServiceError)
    async def service_error(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    @app.get("/api/v1/health", tags=["salud"])
    def health() -> dict:
        return {"status": "ok", "version": VERSION}

    api = APIRouter(prefix="/api/v1", dependencies=[Depends(require_api_key)])
    for module in (files, mapping, templates, jobs):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
