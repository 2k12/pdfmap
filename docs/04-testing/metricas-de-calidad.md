# Métricas de calidad

| Métrica | Fórmula | Objetivo | Fuente |
|---|---|---|---|
| **Cobertura de código (líneas)** | líneas ejecutadas / líneas totales | backend ≥ 80 %, frontend ≥ 70 % | `pytest --cov` (coverage.xml), `vitest --coverage` |
| **Cobertura de ramas (núcleo)** | ramas ejecutadas / ramas totales en `app/core` | ≥ 85 % | coverage `--cov-branch` |
| **Cobertura de requisitos** | requisitos con ≥ 1 caso que pasa / requisitos totales | 100 % Must | [RTM](matriz-trazabilidad-RTM.md) |
| **Tasa de paso** | casos que pasan / casos ejecutados | ≥ 95 % (release: 100 % Must) | JUnit XML de CI |
| **Tasa de ejecución** | casos ejecutados / casos planificados | 100 % | RTM |
| **Densidad de defectos** | defectos confirmados / KLOC | < 2 por KLOC | Issues `type/defect`, `cloc` |
| **DRE** (eficiencia de eliminación) | defectos antes del release / (antes + después) × 100 | ≥ 90 % | Issues con etiqueta `found-in/*` |
| **Fuga de defectos** | defectos en producción / total | < 10 % | Issues |
| **MTTR** (tiempo medio de reparación) | Σ(cierre − apertura) / nº defectos | Crítica < 1 día, alta < 3 días | Fechas de los issues |
| **Edad de defectos abiertos** | hoy − apertura | Ninguno crítico > 2 días | Issues |
| **Inestabilidad (flaky rate)** | tests con resultados distintos en reintentos / total | < 1 % | Reintentos de Playwright/pytest |
| **Tiempo de CI** | duración del pipeline del PR | < 15 min | Actions |
| **Vulnerabilidades** | altas/críticas abiertas | 0 | CodeQL, pip-audit, npm audit, Dependabot |
| **Rendimiento** | pág/s, latencia p95 de la preview, memoria pico | ver RNF-01/02 | `performance/` |

## Ejemplo de cálculo
- 4 defectos encontrados antes del release y 1 después → DRE = 4 / (4 + 1) = **80 %** (por debajo del objetivo → acción de mejora en la retrospectiva).
- 3 defectos en 6 KLOC → densidad = **0,5 / KLOC**.

## Recolección
CI publica como artefactos `coverage.xml`, `junit-*.xml`, `playwright-report/` y `htmlcov/`. Las métricas de defectos se
obtienen con `gh issue list --label type/defect --state all --json createdAt,closedAt,labels`.
