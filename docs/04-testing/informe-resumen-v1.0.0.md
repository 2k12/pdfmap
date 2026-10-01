# Informe resumen de pruebas v1.0.0 (IEEE 829 — Test Summary Report)

## 1. Identificador
`PDFMAP-TSR-1.0.0` · Plan asociado: `PDFMAP-MTP-001` · Fecha: 2026-10-01 · Build: commit inicial de `main`

## 2. Resumen
Se ejecutó el ciclo completo del STLC sobre la versión 1.0.0: backend (FastAPI) y frontend (React).
Todos los requisitos RF-01…RF-18 y RNF-01…RNF-09 tienen al menos una prueba automatizada,
salvo RNF-04 (usabilidad), que es manual. **Conclusión: apto para liberar.** No quedan defectos
abiertos de severidad alta ni media.

## 3. Variaciones
- Las pruebas E2E de navegador (Playwright) se ejecutaron en local contra el stack real (uvicorn + Vite).
  En CI se ejecutan en el job `e2e`.
- No se usaron datos reales. Todo se probó con el reporte sintético de `generate_fixtures.py`
  (ver [datos-de-prueba.md](datos-de-prueba.md)).

## 4. Evaluación de la exhaustividad
| Medida | Objetivo | Real |
|---|---|---|
| Requisitos con casos ejecutados | 100 % | 100 % (26 automatizados + RNF-04 manual) |
| Casos automatizados ejecutados | 100 % | 100 % |
| Cobertura de líneas backend | ≥ 80 % | **96,9 %** |
| Cobertura de líneas frontend | ≥ 70 % | **97,3 %** |

## 5. Resumen de resultados
| Suite | Ubicación | Total | Pasan | Fallan |
|---|---|---|---|---|
| Unitarias backend | `backend/tests/unit` | 132 | 132 | 0 |
| Integración | `backend/tests/integration` | 13 | 13 | 0 |
| API / funcionales | `backend/tests/api` | 48 | 48 | 0 |
| Contrato OpenAPI | `backend/tests/contract` | 10 | 10 | 0 |
| Seguridad | `backend/tests/security` | 14 | 14 | 0 |
| Regresión (golden) | `backend/tests/regression` | 1 | 1 | 0 |
| Sistema E2E vía API | `backend/tests/e2e` | 1 | 1 | 0 |
| Rendimiento y memoria | `backend/tests/performance` | 4 | 4 | 0 |
| Unitarias frontend | `frontend/tests/unit` | 49 | 49 | 0 |
| Componentes | `frontend/tests/component` | 47 | 47 | 0 |
| Accesibilidad (axe, WCAG 2.1 AA) | `frontend/tests/a11y` | 3 | 3 | 0 |
| E2E navegador (Playwright) | `frontend/e2e` | 6 | 6 | 0 (3 ejecuciones seguidas) |
| **Total** | | **328** | **328** | **0** |

Análisis estático: ruff, mypy, bandit, ESLint y `tsc` sin hallazgos. CodeQL y el workflow de seguridad
(pip-audit, npm audit, gitleaks y control de datos reales) pasaron en `main`.

Rendimiento medido (RNF-01/RNF-02): la vista previa de 20 páginas tarda menos de 2 s, y el pico de memoria
al exportar es de 0,8 MB tanto con 10 000 como con 100 000 filas, es decir, memoria constante.

## 6. Defectos encontrados durante el ciclo
| ID | Severidad | Descripción | Detectado por | Estado |
|---|---|---|---|---|
| DEF-001 | Alta | **Inyección de fórmulas**: un texto del PDF que empieza con `=` se escribía como fórmula en el XLSX (y quedaba sin neutralizar en el CSV). | `security/test_api_security.py` (formula injection) | Corregido: se fuerza el tipo texto en Excel y se antepone `'` en el CSV |
| DEF-002 | Media | **Condición de carrera**: el archivo pasaba a `ready` antes de que su trabajo de extracción terminara, y una re-extracción inmediata devolvía 409. | `api/test_files_api.py::test_reextract_with_manual_params` | Corregido: el estado `ready` se escribe después de cerrar el trabajo |
| DEF-003 | Media | Al cancelar una exportación, el exportador de Excel quedaba sin cerrar y se conservaba una salida parcial. | `PytestUnraisableExceptionWarning` en `api/test_jobs_api.py` | Corregido: se cierran los exportadores y se borra la salida parcial |
| DEF-004 | Media | Git con `autocrlf` trataba el PDF de prueba como texto, lo que corrompía el binario al clonar en Windows. | Revisión previa a la publicación | Corregido: `.gitattributes` marca `*.pdf` como binario |
| DEF-005 | Baja | Prueba E2E inestable: dnd-kit descarta el primer clic inmediatamente posterior a soltar un arrastre. | 1 fallo en 3 ejecuciones de `e2e/mapping.spec.ts` | Corregido en la prueba (espera tras el arrastre) |
| DEF-006 | Baja | Pruebas E2E dependientes del orden: contaban filas de otras specs que compartían el mismo backend. | `e2e/upload.spec.ts` | Corregido: ejecución en serie y nombres de archivo únicos |
| DEF-007 | Media | CI: pytest-cov aplicaba el umbral del 80 % a cada suite parcial; la suite unitaria (132/132 OK) terminaba con código 1. | Primer run de CI en `main` | Corregido: `--cov-fail-under=0` por suite y umbral en el `coverage report` combinado |

Densidad de defectos: 7 defectos / ~5 900 LOC (backend ≈ 2 150 + frontend ≈ 3 750) ≈ 1,2 por KLOC. Seis se detectaron antes de publicar y uno (DEF-007) en el primer run de CI; ninguno llegó a una release etiquetada.

## 7. Evaluación
El producto cumple los criterios de salida del plan IEEE 829: 100 % de las pruebas pasan, la cobertura supera los
umbrales y no quedan defectos abiertos de severidad alta ni media.

## 8. Resumen de actividades
Análisis de requisitos (SRS IEEE 830), diseño de casos (70 TC), preparación del entorno (venv, Node 22,
Chromium), ejecución automatizada local y en CI (GitHub Actions: matriz Windows/Linux × Python 3.12/3.13),
registro de defectos y regresión tras cada corrección.

## 9. Aprobaciones
| Rol | Nombre | Fecha |
|---|---|---|
| QA | | |
| Responsable del producto | | |
