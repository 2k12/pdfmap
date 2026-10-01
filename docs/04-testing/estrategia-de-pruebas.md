# Estrategia de pruebas

## Objetivos
1. Garantizar que el motor genérico transforma correctamente cualquier reporte según su plantilla (**exactitud de datos**).
2. Garantizar que los archivos pesados se procesan sin agotar la memoria (**escalabilidad**).
3. Proteger datos confidenciales y la superficie de la API (**seguridad / privacidad**).
4. Asegurar un mapeo visual usable y accesible (**UX / a11y**).

## Pirámide de pruebas

```
              ▲  E2E Playwright (pocas, flujo crítico)        ~5 %
             ▲▲▲  Contrato + API + integración                 ~25 %
          ▲▲▲▲▲▲▲  Unitarias (core, utilidades, componentes)   ~70 %
```
El núcleo `app/core` es puro → la mayor parte de la lógica se cubre con pruebas unitarias rápidas.

## Niveles y tipos

| Tipo | Objetivo | Herramienta | Ubicación | Cuándo |
|---|---|---|---|---|
| **Unitarias** | Converters, patterns, engine, layout, exportadores | pytest, hypothesis | `backend/tests/unit/` | Cada commit / PR |
| **Unitarias frontend** | Utilidades (regex, columnas, uploader, store) | Vitest | `frontend/tests/unit/` | PR |
| **Componentes** | Dropzone, GridViewer, RulesPanel, ExcelDesigner | Vitest + Testing Library | `frontend/tests/component/` | PR |
| **Integración** | services + SQLite + filesystem; extracción real de PDFs sintéticos | pytest | `backend/tests/integration/` | PR |
| **API / funcionales** | Endpoints, códigos de estado, flujos subida → extracción → trabajo → descarga | pytest + `TestClient` | `backend/tests/api/` | PR |
| **Contrato** | Respuestas conformes con OpenAPI; fuzzing basado en el esquema | schemathesis | `backend/tests/contract/` | PR |
| **Regresión** | Golden files: plantilla de ventas sobre fixture sintético → filas y estadísticas esperadas | pytest | `backend/tests/regression/` | PR |
| **E2E** | Flujo completo en navegador: cargar → regla → campo → columnas → procesar → descargar | Playwright | `frontend/e2e/` | PR (job `e2e`) |
| **Rendimiento** | Páginas/s, tiempo de vista previa, memoria | pytest (`perf`, `slow`), tracemalloc | `backend/tests/performance/` | Nightly / manual |
| **Carga** | Usuarios concurrentes consultando páginas/preview | Locust | `backend/tests/performance/locustfile.py` | Pre‑release |
| **Seguridad – negativas** | Path traversal, firma falsa, tamaños, API key, regex, IDs inexistentes | pytest | `backend/tests/security/` | PR |
| **Seguridad – SAST** | Patrones inseguros | Bandit, CodeQL | `security.yml`, `codeql.yml` | PR + semanal |
| **Seguridad – SCA** | Dependencias vulnerables | pip-audit, npm audit, Dependabot | `security.yml` | PR + semanal |
| **Secretos** | Credenciales/datos en el repo | gitleaks | `security.yml` | PR |
| **Accesibilidad** | WCAG 2.1 AA | axe (vitest-axe, @axe-core/playwright) | `frontend/tests/a11y/`, `frontend/e2e/` | PR |
| **Usabilidad** | Tarea "crear plantilla nueva" ≤ 15 min | Sesiones moderadas, SUS | Informe manual | Fin de hito |
| **Compatibilidad** | Chrome, Edge, Firefox (Playwright: chromium, firefox, webkit) | Playwright projects | `frontend/e2e/` | Pre‑release |
| **Portabilidad** | Windows y Linux | Matriz de CI | `ci.yml` | PR |
| **Exploratorias** | Descubrir defectos no previstos | Charters | [checklist](checklist-pruebas-exploratorias.md) | Cada sprint |
| **Smoke / sanity** | Build sano: `/health`, carga mínima, `pytest -m unit -x` | pytest, curl | CI y post‑deploy | Cada build / release |

## Técnicas de diseño de casos

### Particiones de equivalencia
| Entrada | Clases válidas | Clases inválidas |
|---|---|---|
| Extensión | `.pdf`, `.txt`, `.prn`, `.lst` | `.docx`, `.exe`, sin extensión |
| Contenido PDF | empieza con `%PDF-` | otro contenido renombrado a .pdf |
| Número (`decimal="."`) | `1,234.56`, `-5`, `5-`, `(5)`, `.00` | `abc`, `1.2.3`, `NaN`, `Infinity` |
| Fecha `%y/%m/%d` | `21/01/01` | `21/13/01`, `2021-01-01` |
| Acción de regla | row, context, row_context, append, check, skip | `delete`, vacío |

### Valores límite
| Parámetro | Límites probados |
|---|---|
| Tamaño de archivo | 0 B, 1 B, `MAX_UPLOAD_MB` exacto, `MAX + 1 B` |
| Índice de fragmento | −1, 0, `total−1`, `total` |
| Página | 0, 1, `pages`, `pages+1` |
| `limit` de filas/búsqueda | 0, 1, 1000 (500 en búsqueda), máximo + 1 |
| Longitud de regex | 500, 501 |
| Filas por hoja | `max−1`, `max`, `max+1` (con un límite reducido en la prueba) |
| Campo `start/end` | 0, `end=null`, `start ≥ len(línea)`, `start > end` (inválido) |

### Tablas de decisión — resolución de columnas
| ¿Fuente de la regla emisora? | ¿Valor propio nulo? | ¿Hay contexto? | Resultado |
|---|---|---|---|
| Sí | No | — | valor propio |
| Sí | Sí | Sí | **nulo** (no se mezcla con el contexto) |
| No | — | Sí | primer valor no nulo del contexto según el orden de `sources` |
| No | — | No | nulo |
| Meta (`@page`…) | — | — | metadato de la línea |

### Transición de estados
- Archivo: `extracting → ready | error`, `ready → extracting` (re‑extracción), `* → eliminado`.
- Trabajo: `queued → running → done | error | cancelled`, `queued → cancelled`.
- Transiciones inválidas probadas: descargar un trabajo `running` (409), procesar un archivo `extracting` (409), `complete` dos veces (404/409).

### Basadas en propiedades (hypothesis)
- `to_number(format(x))` = x para Decimal aleatorios con distintos separadores.
- `layout_chars` nunca pierde caracteres: el multiconjunto de caracteres no blancos de la salida es igual al de la entrada.
- `suggest_regex(line)` siempre coincide con `line`.

## Criterios de entrada y salida globales
- **Entrada**: build compila; smoke OK; datos sintéticos disponibles.
- **Salida (release)**: 100 % de casos Must ejecutados; ≥ 95 % de casos pasan; 0 defectos críticos o altos abiertos; cobertura ≥ 80/70 %; sin vulnerabilidades altas sin mitigar; informe resumen aprobado.

## Gestión de datos de prueba
Solo datos **sintéticos** ([datos-de-prueba.md](datos-de-prueba.md)). Los reportes reales de clientes están en `.gitignore`
y nunca se usan en pruebas versionadas ni en CI.
