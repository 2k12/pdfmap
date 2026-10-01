# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [0.1.0] - Sin publicar
### Added
- Motor genérico de extracción PDF/TXT a cuadrícula de texto con calibración automática (RF-04).
- Motor de mapeo declarativo por plantillas: reglas, campos, acciones `row`, `context`, `row_context`, `append`, `check` y `skip` (RF-07…RF-10).
- Conversión de tipos con `Decimal`, separador decimal configurable y formatos de fecha (RF-09).
- Asistentes: regex sugerida desde una línea y detección de columnas y tipos (RF-07, RF-08).
- Exportación XLSX en streaming con multi-hoja y CSV con protección ante inyección de fórmulas (RF-15).
- Validación de cuadre de totales (RF-16).
- Plantilla precargada de ejemplo "Ventas por vendedor (ejemplo)" (`builtin-ventas-ejemplo`) sobre el reporte sintético de `generate_fixtures.py` (RF-13).
- API REST FastAPI v1: subida por fragmentos reanudable, archivos, mapeo, plantillas y trabajos (RF-01…RF-18).
- Frontend React con mapeo visual por arrastre y diseñador de columnas (dnd-kit).
- Documentación SDLC/STLC: SRS IEEE 830, plan de pruebas IEEE 829, casos, RTM, ADRs, manual y runbook.
- Plantillas de issues/PR, etiquetas, Dependabot, CODEOWNERS y scripts de bootstrap de GitHub.

