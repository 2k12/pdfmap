# Política de seguridad

## Versiones soportadas
| Versión | Soporte |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ (pre-release) |

## Reportar una vulnerabilidad
**No abras un issue público.** Usa *Security → Report a vulnerability* (GitHub Security Advisories) del repositorio.
Incluye: descripción, impacto, pasos de reproducción (con datos sintéticos) y la versión afectada.

Plazos: acuse de recibo ≤ 3 días hábiles; evaluación ≤ 7 días; corrección según la severidad (crítica ≤ 7 días).

## Medidas implementadas (RNF-03)
- API key opcional (`PDFMAP_API_KEY`, cabecera `X-API-Key`).
- Validación de entrada con Pydantic; límites de tamaño, de `limit` y de longitud de regex.
- Identificadores UUID; rutas confinadas a `PDFMAP_DATA_DIR`; nombres de archivo sanitizados.
- Validación de la firma `%PDF-`; CORS restringido.
- Neutralización de inyección de fórmulas en CSV (valores que empiezan por `=`, `+`, `-`, `@`).
- Procesamiento 100 % local, sin telemetría (RNF-09).
- CI: CodeQL, Bandit, pip-audit, npm audit, gitleaks y Dependabot.

## Datos confidenciales
Los reportes reales de clientes nunca deben subirse al repositorio, a issues ni a PRs. Si ocurre por error:
avisa inmediatamente al responsable, elimina el archivo del historial (`git filter-repo`) y rota cualquier credencial expuesta.
