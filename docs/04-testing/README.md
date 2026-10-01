# 04 · Testing (STLC)

| Documento | Estándar / propósito |
|---|---|
| [stlc.md](stlc.md) | Ciclo de vida de pruebas: fases, entradas, salidas y criterios de entrada y salida |
| [estrategia-de-pruebas.md](estrategia-de-pruebas.md) | Pirámide, niveles, tipos de prueba y técnicas de diseño |
| [plan-de-pruebas-IEEE-829.md](plan-de-pruebas-IEEE-829.md) | Plan maestro de pruebas (IEEE 829) |
| [casos-de-prueba.md](casos-de-prueba.md) | Especificación de casos TC-001…TC-060 |
| [matriz-trazabilidad-RTM.md](matriz-trazabilidad-RTM.md) | Requisito → casos → archivos de test → estado |
| [plantilla-reporte-defectos.md](plantilla-reporte-defectos.md) | Reporte de anomalías (IEEE 1044) y ciclo de vida del defecto |
| [informe-resumen-pruebas.md](informe-resumen-pruebas.md) | Test Summary Report (IEEE 829) |
| [metricas-de-calidad.md](metricas-de-calidad.md) | Cobertura, densidad de defectos, tasa de paso, DRE, MTTR |
| [checklist-pruebas-exploratorias.md](checklist-pruebas-exploratorias.md) | Charters y checklist exploratorio |
| [datos-de-prueba.md](datos-de-prueba.md) | Fixtures sintéticos y generación de PDFs grandes |

## Suites automatizadas

```
backend/tests/
  unit/          # core: converters, patterns, engine, extraction, export
  integration/   # services + SQLite + archivos reales sintéticos
  api/           # endpoints FastAPI con TestClient (funcionales)
  contract/      # OpenAPI / schemathesis
  security/      # pruebas negativas: path traversal, tipos, tamaños, API key, regex
  performance/   # rendimiento (marcador slow/perf) + locustfile.py (carga)
  regression/    # golden files (plantilla de ventas sobre fixture sintético)
  fixtures/      # generate_fixtures.py, PDFs/TXT sintéticos
frontend/
  tests/unit/       # utilidades (regex, columnas, uploader)
  tests/component/  # componentes con Testing Library
  tests/a11y/       # axe (jest-axe / vitest-axe)
  e2e/              # Playwright (flujo completo + axe)
```

Marcadores pytest: `unit`, `integration`, `api`, `contract`, `security`, `perf`, `slow`, `regression`, y `req("RF-xx")` para trazabilidad.
Frontend: el nombre del test lleva el prefijo `[RF-xx]`.
