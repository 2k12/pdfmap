# ADR-003: SQLite + pool de hilos para persistencia y trabajos

- **Estado**: Aceptado · **Fecha**: 2026-10-01 · **Requisitos**: RF-14, RF-17, RNF-07, RNF-08, RNF-09

## Contexto
Los trabajos de extracción y exportación de archivos de miles de páginas tardan de segundos a minutos. El despliegue
objetivo es local o en un solo servidor, con datos confidenciales y sin equipo de operaciones.

## Opciones
1. **SQLite (WAL) + `ThreadPoolExecutor`** dentro del proceso de la API.
2. PostgreSQL + Celery/RQ + Redis: robusto y distribuido, pero exige 3 servicios más.
3. Procesos con `multiprocessing`: aislamiento real, pero complica pypdfium2, la cancelación y el progreso compartido.

## Decisión
Opción 1. Tablas `files`, `lines`, `templates`, `jobs`, `job_rows` y `uploads`; WAL y `busy_timeout` para lectores
concurrentes; pool de `PDFMAP_WORKERS` hilos; cancelación cooperativa mediante un `Event` por trabajo; progreso
persistido con limitación de frecuencia. Al arrancar, los trabajos `running` huérfanos se marcan `error`.

## Consecuencias
- ✅ Cero infraestructura adicional; una sola imagen Docker; portable a Windows.
- ✅ Las líneas y filas en SQLite permiten paginar y vista previa sin releer archivos.
- ⚠️ El GIL limita el paralelismo de CPU; aceptable porque pdfium (C) libera tiempo y el cuello de botella es secuencial por archivo.
- ⚠️ Escalado horizontal no soportado; si se requiere, migrar a la opción 2 (los servicios están detrás de interfaces).
