# Plan maestro de pruebas (IEEE 829-2008)

## 1. Identificador del plan
`PDFMAP-MTP-001` · Versión 1.0 · 2026-10-01 · Aplica a los releases v0.1–v1.0.

## 2. Introducción y referencias
Plan de pruebas del sistema PDFMap (backend FastAPI + frontend React). Referencias: [SRS](../01-requisitos/SRS-IEEE-830.md),
[arquitectura](../03-diseno/arquitectura.md), [contrato API](../architecture/api-contract.md), [estrategia](estrategia-de-pruebas.md), [STLC](stlc.md).

## 3. Elementos de prueba (test items)
| Elemento | Versión | Ubicación |
|---|---|---|
| Núcleo de extracción | 1.0 | `backend/app/core/extraction/` |
| Motor de mapeo, converters, patterns | 1.0 | `backend/app/core/mapping/` |
| Exportadores XLSX/CSV | 1.0 | `backend/app/core/export/` |
| Servicios (storage, files, jobs, templates, db) | 1.0 | `backend/app/services/` |
| API REST v1 | 1.0 | `backend/app/api/` |
| Plantilla precargada de ejemplo (ventas por vendedor) | 1 | `backend/app/templates_builtin/` |
| Frontend SPA | 1.0 | `frontend/src/` |
| Imagen Docker / compose | 1.0 | `Dockerfile`s, `docker-compose.yml` |

## 4. Funcionalidades a probar
RF-01 a RF-18 y RNF-01 a RNF-09 (ver [RTM](matriz-trazabilidad-RTM.md)).

## 5. Funcionalidades que no se prueban
- OCR de PDFs escaneados (fuera de alcance).
- PDFs cifrados con contraseña (se reportan como error; no se prueban variantes de cifrado).
- Escalado horizontal / múltiples instancias.
- Navegadores antiguos (IE, versiones con más de 2 años).
- Reportes reales de clientes: nunca se usan en pruebas versionadas ni en CI (RNF-09); solo fixtures sintéticos.

## 6. Enfoque
Según la [estrategia](estrategia-de-pruebas.md): pirámide con predominio de pruebas unitarias del núcleo puro, integración
con SQLite real en `tmp_path`, API con `TestClient`, contrato con schemathesis, regresión con golden files, E2E Playwright,
rendimiento con pytest + Locust, seguridad con pruebas negativas + SAST/SCA/secretos, accesibilidad con axe.
Automatización en GitHub Actions en cada PR; rendimiento y compatibilidad completa antes de cada release.

## 7. Criterios de aprobación/fallo por elemento
- Un **caso** pasa si el resultado observado coincide con el esperado en [casos-de-prueba.md](casos-de-prueba.md).
- Un **elemento** pasa si: todos sus casos Must pasan, la cobertura alcanza el umbral (backend 80 %, frontend 70 %) y no hay defectos críticos/altos abiertos.
- **Rendimiento**: extracción ≥ 40 pág/s; preview de 20 páginas < 2 s; memoria < 300 MB RSS con 1 GB.
- **Seguridad**: 0 hallazgos altos/críticos de Bandit/CodeQL/pip-audit/npm audit sin mitigar; gitleaks sin hallazgos.
- **Accesibilidad**: 0 violaciones axe de impacto `serious`/`critical`.

## 8. Criterios de suspensión y requisitos de reanudación
- **Suspensión**: smoke fallido; build roto; defecto crítico en el flujo principal; > 30 % de casos bloqueados; entorno de CI no disponible.
- **Reanudación**: corrección fusionada, smoke verde, re‑ejecución completa de la suite afectada más la regresión.

## 9. Entregables de prueba
Plan (este documento), [especificación de casos](casos-de-prueba.md), [RTM](matriz-trazabilidad-RTM.md), scripts automatizados,
fixtures sintéticos, reportes JUnit/cobertura (artefactos de CI), reportes de defectos (issues `type/defect`),
[informe resumen](informe-resumen-pruebas.md), [métricas](metricas-de-calidad.md).

## 10. Tareas de prueba
| # | Tarea | Responsable | Dependencia |
|---|---|---|---|
| T1 | Análisis de requisitos y RTM inicial | QA | SRS 1.0 |
| T2 | Diseño de casos y fixtures sintéticos | QA + Dev | T1 |
| T3 | Pruebas unitarias del núcleo | Dev backend | Código core |
| T4 | Pruebas API/integración/contrato/seguridad | QA + Dev backend | API |
| T5 | Pruebas de componentes y a11y | Dev frontend | UI |
| T6 | E2E Playwright | QA | T4, T5 |
| T7 | Rendimiento y carga | QA + DevOps | Release candidate |
| T8 | Exploratorias y usabilidad | QA + PO | Hito |
| T9 | Informe resumen y cierre | QA | T3–T8 |

## 11. Necesidades de entorno
| Elemento | Especificación |
|---|---|
| SO | Windows 11 (local), Ubuntu 24.04 y Windows (runners de GitHub Actions) |
| Python | 3.12+ en `.venv` (nunca global) |
| Node | 20 LTS+ |
| Navegadores | Chromium, Firefox, WebKit (Playwright) |
| Datos | Fixtures sintéticos generados por `backend/tests/fixtures/generate_fixtures.py` |
| Aislamiento | `PDFMAP_DATA_DIR` temporal por prueba |

## 12. Responsabilidades
| Rol | Responsabilidad |
|---|---|
| QA (agente `qa-test-engineer`) | Plan, casos, RTM, exploratorias, informes |
| Desarrolladores | Unitarias, corrección de defectos, regresión |
| DevOps | Pipelines, entornos, artefactos |
| Product Owner | Aceptación, priorización de defectos |

## 13. Personal y capacitación
Conocimientos requeridos: pytest, Playwright, regex, estructura de reportes PDF. Material: [manual de usuario](../05-operacion/manual-usuario.md) y [modelo de plantilla](../architecture/template-model.md).

## 14. Calendario
| Hito | Ventana de pruebas |
|---|---|
| v0.1 | Sprint 1 (últimos 3 días) |
| v0.2 | Sprints 2–3 |
| v0.3 | Sprint 4 |
| v1.0 | Sprint 5: regresión completa, rendimiento, seguridad y aceptación |

## 15. Riesgos y contingencias
| Riesgo | Contingencia |
|---|---|
| No hay PDFs reales variados (privacidad) | Generador sintético con varios layouts (monoespaciado, proporcional, multipágina, montos con coma) |
| Pruebas E2E inestables | Reintentos (2) en CI, selectores por rol/etiqueta, trazas de Playwright como artefacto |
| Pruebas de rendimiento lentas en CI | Marcador `slow`, job nocturno/manual |
| Diferencias Windows/Linux | Matriz de SO en CI |

## 16. Aprobaciones
| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Product Owner | | | |
| Líder QA | | | |
| Líder técnico | | | |
