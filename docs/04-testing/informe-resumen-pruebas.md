# Informe resumen de pruebas (IEEE 829 — Test Summary Report)

> Plantilla. Duplicar como `informe-resumen-vX.Y.Z.md` al cerrar cada release y completar los `{{…}}`.

## 1. Identificador
`PDFMAP-TSR-{{versión}}` · Plan asociado: `PDFMAP-MTP-001` · Fecha: {{fecha}}

## 2. Resumen
{{Descripción breve de lo probado en el release, el build/commit (`{{sha}}`) y la conclusión general.}}

## 3. Variaciones
{{Desviaciones respecto al plan: casos omitidos, cambios de entorno o de alcance, y su justificación.}}

## 4. Evaluación de la exhaustividad
| Medida | Objetivo | Real |
|---|---|---|
| Requisitos con casos ejecutados | 100 % | {{ }} |
| Casos planificados ejecutados | 100 % | {{ }} |
| Cobertura de líneas backend | ≥ 80 % | {{ }} |
| Cobertura de líneas frontend | ≥ 70 % | {{ }} |
| Cobertura de ramas del núcleo (`app/core`) | ≥ 85 % | {{ }} |

## 5. Resumen de resultados
| Suite | Total | Pasan | Fallan | Omitidas | Duración |
|---|---|---|---|---|---|
| Unitarias backend | {{ }} | | | | |
| Integración | | | | | |
| API | | | | | |
| Contrato | | | | | |
| Seguridad | | | | | |
| Regresión | | | | | |
| Rendimiento | | | | | |
| Frontend unit/componentes | | | | | |
| Accesibilidad | | | | | |
| E2E (chromium/firefox/webkit) | | | | | |
| Exploratorias (charters) | | | | | |

### Defectos
| Severidad | Encontrados | Corregidos | Abiertos | Diferidos |
|---|---|---|---|---|
| Crítica | | | | |
| Alta | | | | |
| Media | | | | |
| Baja | | | | |

### Rendimiento (RNF-01/02)
| Métrica | Objetivo | Real |
|---|---|---|
| Extracción (pág/s) | ≥ 40 | {{ }} |
| Vista previa de 20 páginas | < 2 s | {{ }} |
| Memoria pico con 1 GB | < 300 MB | {{ }} |
| Locust p95 páginas | < 500 ms | {{ }} |

### Seguridad
| Herramienta | Altos/críticos | Estado |
|---|---|---|
| CodeQL | | |
| Bandit | | |
| pip-audit | | |
| npm audit | | |
| gitleaks | | |

## 6. Evaluación
{{Valoración de la calidad del release por elemento de prueba; riesgos residuales; limitaciones conocidas (p. ej. PDFs escaneados).}}

## 7. Resumen de actividades
| Actividad | Esfuerzo (h) | Recursos |
|---|---|---|
| Diseño de casos | | |
| Automatización | | |
| Ejecución manual / exploratoria | | |
| Gestión de defectos | | |

## 8. Aprobaciones
| Rol | Nombre | Decisión (Aprobado / Rechazado) | Fecha |
|---|---|---|---|
| Product Owner | | | |
| Líder QA | | | |
| Líder técnico | | | |
