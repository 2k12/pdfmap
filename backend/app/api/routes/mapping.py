from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import ValidationError

from ...core.mapping import suggest_columns, suggest_regex
from ...schemas import AnnotateIn, PreviewIn, SuggestColumnsIn, SuggestRegexIn, Template, ValidateIn, ValidateOut
from ...services.container import Services
from ..deps import get_services

router = APIRouter(prefix="/mapping", tags=["mapeo"])


@router.post("/suggest-regex")
def post_suggest_regex(body: SuggestRegexIn) -> dict:
    return {"regex": suggest_regex(body.line, body.tokens)}


@router.post("/suggest-columns")
def post_suggest_columns(body: SuggestColumnsIn) -> dict:
    return {"segments": suggest_columns(body.lines, body.min_gap)}


@router.post("/validate", response_model=ValidateOut)
def validate(body: ValidateIn) -> dict:
    try:
        Template.model_validate(body.template)
    except ValidationError as exc:
        errors = [f"{'.'.join(map(str, e['loc'])) or 'plantilla'}: {e['msg']}" for e in exc.errors()]
        return {"valid": False, "errors": errors}
    return {"valid": True, "errors": []}


@router.post("/annotate")
def annotate(body: AnnotateIn, s: Services = Depends(get_services)) -> dict:
    return s.mapping.annotate(body.file_id, body.template.engine_dict(), body.page)


@router.post("/preview")
def preview(body: PreviewIn, s: Services = Depends(get_services)) -> dict:
    return s.mapping.preview(body.file_id, body.template.engine_dict(), body.start_page, body.max_pages, body.limit)
