class ServiceError(Exception):
    """Error de negocio con código HTTP asociado."""

    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


class NotFound(ServiceError):
    status_code = 404


class Conflict(ServiceError):
    status_code = 409


class Forbidden(ServiceError):
    status_code = 403


class TooLarge(ServiceError):
    status_code = 413


class Unsupported(ServiceError):
    status_code = 415
