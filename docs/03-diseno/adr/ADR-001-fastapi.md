# ADR-001: FastAPI como framework de backend

- **Estado**: Aceptado · **Fecha**: 2026-10-01 · **Requisitos**: RNF-03, RNF-06, RF-02

## Contexto
El prototipo existente está en Python y depende de pypdfium2 y openpyxl. Se necesita una API REST con
validación fuerte de entrada, documentación automática y soporte de cuerpos binarios para la subida por fragmentos.

## Opciones
1. **FastAPI** — ASGI, Pydantic v2, OpenAPI automático, inyección de dependencias, `TestClient`.
2. Flask — simple, pero la validación y OpenAPI requieren extensiones.
3. Django + DRF — demasiado pesado (ORM y administración innecesarios).
4. Node/Express — obligaría a reescribir la extracción fuera del ecosistema Python.

## Decisión
FastAPI con Uvicorn. Pydantic valida plantillas y peticiones; el núcleo (`app/core`) recibe diccionarios ya validados.

## Consecuencias
- ✅ OpenAPI en `/openapi.json` permite pruebas de contrato (schemathesis) y la generación de tipos del frontend.
- ✅ `TestClient` facilita las pruebas de API.
- ⚠️ pypdfium2 no es thread-safe: se serializa con un candado (`PDFIUM_LOCK`) y el trabajo pesado se hace en hilos de trabajo, no en el event loop.
