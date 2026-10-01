# CLAUDE.md — Guía del proyecto PDFMap para Claude Code

## Qué es
**PDFMap**: mapeador **visual y genérico** de reportes PDF/TXT de formato desconocido a Excel.
El backend (FastAPI) extrae cada página como una **cuadrícula de texto de ancho fijo** y aplica una **plantilla declarativa**
(reglas → campos → columnas). El frontend (React) permite construir esa plantilla de forma gráfica: seleccionar líneas,
arrastrar sobre el texto para crear campos y arrastrar columnas para diseñar el Excel.
Incluye una plantilla precargada de ejemplo, **Ventas por vendedor (ejemplo)** (`builtin-ventas-ejemplo`, en `backend/app/templates_builtin/`), que mapea el reporte sintético generado por `backend/tests/fixtures/generate_fixtures.py`.

## Estructura
```
backend/
  app/core/        # PURO (sin FastAPI/SQLite): extraction/, mapping/ (engine, converters, patterns), export/
  app/services/    # db SQLite, storage, files, jobs, templates
  app/api/         # rutas FastAPI /api/v1, deps, schemas Pydantic
  app/templates_builtin/
  tests/{unit,integration,api,contract,security,performance,regression,fixtures}
frontend/
  src/             # React + TS + Vite (dnd-kit)
  tests/{unit,component,a11y}   e2e/ (Playwright)
docs/              # 01-requisitos (SRS IEEE 830) · 02-sdlc · 03-diseno · architecture (contratos) · 04-testing (STLC) · 05-operacion
.github/           # workflows, plantillas de issues/PR, labels, dependabot, CODEOWNERS
.claude/agents/    # subagentes especializados
scripts/github/    # bootstrap de etiquetas, hitos e issues
```

## Comandos (Windows / PowerShell)
```powershell
# Backend — SIEMPRE en el venv de la raíz
.\.venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --reload            # API en :8000, Swagger en /docs
pytest                                   # todo
pytest -m unit                           # por suite: unit|integration|api|contract|security|regression|perf
pytest -m "not slow"                     # sin rendimiento
ruff check . ; mypy app

# Frontend
cd frontend
npm ci ; npm run dev                     # :5173 (proxy /api → :8000)
npm test ; npm run test:e2e ; npm run lint ; npm run typecheck ; npm run build

# Docker
docker compose up --build
```

## Reglas obligatorias
1. **Entorno Python**: nunca ejecutes `pip install` global ni fuera del venv. Para dependencias nuevas, añádelas a
   `backend/requirements*.txt` y **entrega al usuario los comandos** (`.\.venv\Scripts\Activate.ps1; pip install -r backend\requirements-dev.txt`) para que los ejecute él.
   Para ejecutar scripts usa `.venv\Scripts\python.exe`.
2. **Datos confidenciales**: los archivos de la raíz `*.Pdf` / `*.pdf` / `*.xlsx` son datos reales de clientes. **Nunca** se
   commitean, se copian a fixtures ni se pegan en issues/PRs/logs. Usa `backend/tests/fixtures/generate_fixtures.py`.
3. **Trazabilidad**: todo cambio se vincula a un requisito `RF-xx`/`RNF-xx` del [SRS](docs/01-requisitos/SRS-IEEE-830.md).
   Los tests de backend llevan `@pytest.mark.req("RF-xx")` y un marcador de suite; los de frontend, `[RF-xx]` en el nombre.
4. **Docs sincronizadas**: si cambias la API → `docs/architecture/api-contract.md`; el esquema de plantilla → `template-model.md`;
   tests → `docs/04-testing/casos-de-prueba.md` y `matriz-trazabilidad-RTM.md`; siempre → `CHANGELOG.md` (Unreleased).
5. **Arquitectura**: `app/core` no importa FastAPI, Pydantic ni SQLite; recibe `dict` ya validados. Todo en streaming (generadores), nunca cargar el archivo completo en memoria.
6. **Git/GitHub**: Conventional Commits, ramas `feature/RF-xx-*`, `fix/DEF-xxx-*`. No crear repos, issues ni PRs, ni hacer push, sin la confirmación del usuario.

## Convenciones
- Código y docs en español (identificadores pueden mezclar, siguiendo el código existente).
- Python ≥ 3.12, tipado, ruff (línea de 120), `Decimal` para montos.
- TypeScript `strict`, componentes funcionales, accesibilidad (roles, labels, teclado).
- Cobertura mínima: backend 80 %, frontend 70 %.

## Documentos clave
- Requisitos: `docs/01-requisitos/SRS-IEEE-830.md`
- Contrato API: `docs/architecture/api-contract.md` · Plantilla: `docs/architecture/template-model.md`
- Arquitectura y ADRs: `docs/03-diseno/`
- STLC / plan / casos / RTM: `docs/04-testing/`
- Proceso (SDLC, ramas, DoD): `docs/02-sdlc/`

## Subagentes (`.claude/agents/`)
`requirements-analyst`, `backend-engineer`, `frontend-engineer`, `qa-test-engineer`, `devops-engineer`, `code-reviewer`. Ver [AGENTS.md](AGENTS.md).
