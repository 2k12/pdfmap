# AGENTS.md — Instrucciones para agentes de IA

Este archivo resume lo que cualquier agente (Claude Code, Codex, Copilot, Cursor…) debe saber para trabajar en **PDFMap**.
Para Claude Code hay más detalle en [CLAUDE.md](CLAUDE.md).

## Proyecto
Mapeador visual y genérico de reportes PDF/TXT de formato desconocido a Excel.
- **Backend**: Python ≥ 3.12, FastAPI, pypdfium2, openpyxl (`write_only`), SQLite. Capas `api → services → core` (core puro).
- **Frontend**: React + TypeScript + Vite, dnd-kit, Vitest, Playwright.
- **Modelo**: plantilla JSON con reglas (match + campos + acción) y columnas → ver `docs/architecture/template-model.md`.

## Setup y verificación
```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r backend\requirements-dev.txt
cd backend; ruff check .; mypy app; pytest -m "not slow"
cd ..\frontend; npm ci; npm run lint; npm run typecheck; npm test; npm run build
```
> No instales paquetes de Python fuera del venv. Si hace falta una dependencia, añádela a `requirements*.txt` y pide al usuario que ejecute la instalación.

## Reglas no negociables
1. **Nunca** leas para publicar, commitees ni copies los reportes reales de la raíz (`*.Pdf`, `*.xlsx`): son confidenciales. Usa fixtures sintéticos.
2. Vincula cada cambio a un `RF-xx`/`RNF-xx`; marca los tests (`@pytest.mark.req("RF-xx")`, `[RF-xx]`).
3. Actualiza la documentación afectada y la RTM en el mismo cambio.
4. Mantén el streaming (memoria constante) y la pureza de `app/core`.
5. Conventional Commits; ramas `feature/RF-xx-*`; no hagas push ni crees issues/PRs sin la autorización del usuario.

## Subagentes especializados (`.claude/agents/`)

| Agente | Fase SDLC/STLC | Responsabilidad |
|---|---|---|
| `requirements-analyst` | Análisis | Mantiene el SRS IEEE 830, casos de uso, historias y criterios de aceptación; asigna IDs RF/RNF |
| `backend-engineer` | Diseño / implementación | FastAPI, motor de extracción/mapeo, exportadores, SQLite; tests backend |
| `frontend-engineer` | Diseño / implementación | UI React de mapeo visual, dnd-kit, accesibilidad; tests Vitest/Playwright |
| `qa-test-engineer` | STLC completo | Plan IEEE 829, casos, RTM, suites de todos los tipos, defectos IEEE 1044, informes y métricas |
| `devops-engineer` | Despliegue / mantenimiento | GitHub Actions, Docker, releases, Dependabot, seguridad de la cadena |
| `code-reviewer` | Revisión | Revisión de PRs: corrección, seguridad, trazabilidad, pruebas y docs |

## Mapa de documentación
`docs/01-requisitos` (SRS) · `docs/02-sdlc` (proceso) · `docs/03-diseno` (arquitectura, ADR) · `docs/architecture` (contratos) ·
`docs/04-testing` (STLC) · `docs/05-operacion` (despliegue, manual, runbook).
