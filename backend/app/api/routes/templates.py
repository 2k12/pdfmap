from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from ...schemas import Template, TemplateSummary
from ...services.container import Services
from ..deps import get_services

router = APIRouter(prefix="/templates", tags=["plantillas"])


@router.get("", response_model=list[TemplateSummary])
def list_templates(s: Services = Depends(get_services)) -> list[dict]:
    return s.templates.list()


@router.get("/{template_id}", response_model=Template)
def get_template(template_id: str, s: Services = Depends(get_services)) -> dict:
    return s.templates.get(template_id)


@router.post("", response_model=Template, status_code=status.HTTP_201_CREATED)
def create_template(body: Template, s: Services = Depends(get_services)) -> dict:
    return s.templates.create(body)


@router.put("/{template_id}", response_model=Template)
def update_template(template_id: str, body: Template, s: Services = Depends(get_services)) -> dict:
    return s.templates.update(template_id, body)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str, s: Services = Depends(get_services)) -> Response:
    s.templates.delete(template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
