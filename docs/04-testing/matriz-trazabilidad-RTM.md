# Matriz de trazabilidad de requisitos (RTM)

Trazabilidad bidireccional: **requisito → historia → casos → archivos de test → estado**.
Los tests de backend llevan `@pytest.mark.req("RF-xx")`; los de frontend, el prefijo `[RF-xx]` en el nombre.
Se puede regenerar el inventario automatizado con:

```powershell
cd backend; pytest --collect-only -q -m "req" | Select-String "RF-|RNF-"
cd frontend; npx vitest list | Select-String "\[RF-"
```

Estados: ⬜ Pendiente · 🟨 En progreso · ✅ Pasa · ❌ Falla · ⏸️ Bloqueado · ➖ Manual.

| Requisito | Prio | HU | Casos | Archivos de test | Estado |
|---|---|---|---|---|---|
| RF-01 Carga arrastrar/seleccionar | Must | HU-01 | TC-001, TC-002, TC-003 | `frontend/tests/component/FilesPage.test.tsx`, `frontend/e2e/upload.spec.ts` | ⬜ |
| RF-02 Subida por fragmentos | Must | HU-02 | TC-004…TC-009 | `backend/tests/api/test_uploads_api.py`, `frontend/tests/unit/uploader.test.ts` | ⬜ |
| RF-03 Validación tipo/tamaño | Must | HU-03 | TC-010…TC-013 | `backend/tests/unit/test_security_utils.py`, `api/test_uploads_api.py`, `security/test_api_security.py` | ⬜ |
| RF-04 Extracción y calibración | Must | HU-04, HU-05 | TC-014…TC-019 | `backend/tests/unit/test_extraction_layout.py`, `integration/test_pdf_pipeline.py`, `api/test_files_api.py` | ⬜ |
| RF-05 Visualización paginada | Must | HU-04 | TC-020, TC-021 | `backend/tests/api/test_files_api.py` | ⬜ |
| RF-06 Búsqueda | Should | HU-06 | TC-022…TC-024 | `backend/tests/api/test_files_api.py`, `security/test_api_security.py` | ⬜ |
| RF-07 Regla desde línea | Must | HU-07 | TC-025…TC-027 | `backend/tests/unit/test_patterns.py`, `api/test_mapping_api.py`, `e2e/test_system_flow.py`, `frontend/e2e/mapping.spec.ts` | ⬜ |
| RF-08 Campos por arrastre + detección | Must | HU-08, HU-09 | TC-028…TC-030 | `backend/tests/unit/test_patterns.py`, `frontend/tests/component/MapperPage.test.tsx`, `frontend/tests/unit/lib.test.ts` | ⬜ |
| RF-09 Tipos y conversión | Must | HU-10 | TC-031…TC-035 | `backend/tests/unit/test_converters.py`, `unit/test_engine.py` | ⬜ |
| RF-10 Acciones de regla | Must | HU-11, HU-12 | TC-036…TC-040 | `backend/tests/unit/test_engine.py` | ⬜ |
| RF-11 Diseño de columnas | Must | HU-13 | TC-041, TC-042 | `frontend/tests/component/DesignerPanel.test.tsx`, `frontend/e2e/mapping.spec.ts` | ⬜ |
| RF-12 Vista previa | Must | HU-14 | TC-043…TC-045 | `backend/tests/api/test_mapping_api.py`, `e2e/test_system_flow.py`, `performance/test_performance.py` | ⬜ |
| RF-13 Plantillas | Must | HU-15 | TC-046…TC-048 | `backend/tests/api/test_templates_api.py`, `unit/test_template_schema.py`, `frontend/tests/component/TemplatesPage.test.tsx` | ⬜ |
| RF-14 Trabajos en segundo plano | Must | HU-16 | TC-049…TC-051 | `backend/tests/api/test_jobs_api.py`, `integration/test_services.py` | ⬜ |
| RF-15 Exportación XLSX/CSV | Must | HU-17 | TC-052…TC-054 | `backend/tests/unit/test_exporters.py`, `api/test_jobs_api.py` | ⬜ |
| RF-16 Cuadre y errores | Should | HU-18 | TC-055, TC-056 | `backend/tests/regression/test_golden.py`, `unit/test_engine.py` | ⬜ |
| RF-17 Resultados paginados | Should | HU-19 | TC-057 | `backend/tests/api/test_jobs_api.py` | ⬜ |
| RF-18 Eliminación | Must | HU-20 | TC-058 | `backend/tests/api/test_files_api.py` | ⬜ |
| RNF-01 Rendimiento | Must | – | TC-045, TC-059, TC-061 | `backend/tests/performance/test_performance.py`, `performance/locustfile.py` | ⬜ |
| RNF-02 Memoria constante | Must | – | TC-060 | `backend/tests/performance/test_performance.py` | ⬜ |
| RNF-03 Seguridad | Must | – | TC-010…TC-012, TC-023, TC-024, TC-062…TC-064 | `backend/tests/security/*`, `contract/*`, CodeQL, Bandit, pip-audit, npm audit | ⬜ |
| RNF-04 Usabilidad | Should | – | TC-066 | Manual | ➖ |
| RNF-05 Accesibilidad | Should | – | TC-065 | `frontend/tests/a11y/a11y.test.tsx` | ⬜ |
| RNF-06 Mantenibilidad | Must | – | TC-070 | `ci.yml` (cobertura, ruff, mypy, eslint, tsc) | ⬜ |
| RNF-07 Portabilidad | Should | – | TC-067 | Matriz de SO en `ci.yml`, build Docker | ⬜ |
| RNF-08 Confiabilidad | Must | – | TC-051, TC-068 | `integration/test_services.py`, `unit/test_engine.py` | ⬜ |
| RNF-09 Privacidad | Must | – | TC-069 | `security.yml` (gitleaks), `.gitignore` | ⬜ |

## Cobertura de requisitos
- Requisitos totales: 27 (18 RF + 9 RNF).
- Con al menos un caso: 27/27 (100 %).
- Con automatización: 26/27 (RNF-04 es manual).

## Trazabilidad inversa (caso → requisito)
Cada caso de [casos-de-prueba.md](casos-de-prueba.md) indica su requisito en la columna **Req**; ningún caso existe sin requisito.
