from __future__ import annotations

import secrets

from fastapi import Depends, Header, HTTPException, Request, status

from ..services.container import Services


def get_services(request: Request) -> Services:
    return request.app.state.services


def require_api_key(
    services: Services = Depends(get_services),
    x_api_key: str | None = Header(default=None),
) -> None:
    expected = services.settings.api_key
    if expected and not (x_api_key and secrets.compare_digest(x_api_key, expected)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API key inválida o ausente")
