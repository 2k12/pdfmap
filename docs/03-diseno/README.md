# 03 · Diseño

| Documento | Descripción |
|---|---|
| [arquitectura.md](arquitectura.md) | Modelo C4 (contexto, contenedores, componentes), secuencias, modelo de datos |
| [../architecture/api-contract.md](../architecture/api-contract.md) | Contrato de la API REST v1 |
| [../architecture/template-model.md](../architecture/template-model.md) | Modelo JSON de plantilla (reglas, campos, columnas) |
| [adr/](adr/) | Registros de decisiones de arquitectura |

## ADRs
| ID | Decisión | Estado |
|---|---|---|
| [ADR-001](adr/ADR-001-fastapi.md) | FastAPI como framework de backend | Aceptado |
| [ADR-002](adr/ADR-002-cuadricula-texto-generica.md) | Cuadrícula de texto genérica en lugar de un parser fijo | Aceptado |
| [ADR-003](adr/ADR-003-sqlite-hilos.md) | SQLite + pool de hilos para trabajos | Aceptado |
| [ADR-004](adr/ADR-004-openpyxl-write-only.md) | openpyxl `write_only` para Excel en streaming | Aceptado |
| [ADR-005](adr/ADR-005-react-vite-dndkit.md) | React + Vite + dnd-kit para el frontend | Aceptado |
