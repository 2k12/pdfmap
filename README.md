# PDFMap — Mapeador visual de reportes PDF/TXT a Excel

[![CI](https://github.com/2k12/pdfmap/actions/workflows/ci.yml/badge.svg)](https://github.com/2k12/pdfmap/actions/workflows/ci.yml)
[![CodeQL](https://github.com/2k12/pdfmap/actions/workflows/codeql.yml/badge.svg)](https://github.com/2k12/pdfmap/actions/workflows/codeql.yml)
[![Security](https://github.com/2k12/pdfmap/actions/workflows/security.yml/badge.svg)](https://github.com/2k12/pdfmap/actions/workflows/security.yml)
![Coverage backend](https://img.shields.io/badge/coverage%20backend-%E2%89%A580%25-brightgreen)
![Coverage frontend](https://img.shields.io/badge/coverage%20frontend-%E2%89%A570%25-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Los badges apuntan a `2k12/pdfmap`; ajústalos al nombre real del repositorio.

**PDFMap** convierte reportes de sistemas heredados (estados de cuenta, inventarios, mayores…) en Excel **sin programar**,
aunque no se conozca de antemano el formato del PDF. Arrastras el archivo, señalas las líneas y los datos sobre el texto
y diseñas las columnas del Excel arrastrándolas. El backend aplica esa plantilla en streaming sobre archivos de miles de páginas.

```
 Cargar ──▶ Mapear ──────────────────▶ Diseñar Excel ─────────▶ Procesar
 (arrastrar,  (clic en línea → regla,   (arrastrar columnas,      (segundo plano,
  fragmentos)  arrastrar → campo)        vista previa en vivo)     XLSX/CSV, cuadre)
```

## Características
- 📤 Subida por **fragmentos reanudable** (hasta 2 GB por defecto).
- 🔎 Extracción genérica a **cuadrícula de texto** con calibración automática (fuentes monoespaciadas y proporcionales).
- 🖱️ **Mapeo visual**: reglas desde una línea con regex sugerida, campos por arrastre y detección automática de columnas y tipos.
- 🧩 Acciones: fila, contexto (encabezados de grupo), fila + contexto, anexar (multilínea), control de cuadre, ignorar.
- 📊 **Diseñador de Excel** con dnd-kit, vista previa en vivo, totales y formatos.
- ⚙️ Procesamiento en segundo plano con progreso y cancelación; XLSX en streaming (multi-hoja) y CSV.
- 💾 Plantillas reutilizables (importar/exportar JSON). Incluye la plantilla de ejemplo **Ventas por vendedor (ejemplo)**.
- 🔒 Local y privado: sin servicios externos; API key opcional.

## Inicio rápido

### Backend (Windows / PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt
cd backend
uvicorn app.main:app --reload          # http://localhost:8000/docs
```

### Frontend
```powershell
cd frontend
npm ci
npm run dev                            # http://localhost:5173
```

### Docker
```powershell
docker compose up --build              # http://localhost:8080
```

Variables de entorno (`PDFMAP_DATA_DIR`, `PDFMAP_MAX_UPLOAD_MB`, `PDFMAP_CHUNK_SIZE_MB`, `PDFMAP_API_KEY`, `PDFMAP_CORS_ORIGINS`, `PDFMAP_WORKERS`):
ver [despliegue](docs/05-operacion/despliegue.md).

## Estructura
```
.
├── backend/                 FastAPI
│   ├── app/core/            extracción, motor de mapeo, exportadores (puro)
│   ├── app/services/        SQLite, almacenamiento, trabajos, plantillas
│   ├── app/api/             rutas /api/v1
│   ├── app/templates_builtin/
│   └── tests/               unit · integration · api · contract · security · performance · regression · fixtures
├── frontend/                React + TS + Vite
│   ├── src/
│   ├── tests/               unit · component · a11y
│   └── e2e/                 Playwright
├── docs/                    SDLC/STLC (ver abajo)
├── .github/                 workflows, plantillas de issues/PR, labels, dependabot, CODEOWNERS
├── .claude/agents/          subagentes especializados
├── scripts/github/          bootstrap de etiquetas, hitos e issues
└── CLAUDE.md · AGENTS.md
```

## Documentación
| Área | Documento |
|---|---|
| Requisitos | [SRS IEEE 830](docs/01-requisitos/SRS-IEEE-830.md) · [Casos de uso](docs/01-requisitos/casos-de-uso.md) · [Historias](docs/01-requisitos/historias-de-usuario.md) |
| Proceso | [Modelo SDLC](docs/02-sdlc/modelo-sdlc.md) · [Plan](docs/02-sdlc/plan-proyecto.md) · [Ramas y releases](docs/02-sdlc/gestion-configuracion.md) · [DoR/DoD](docs/02-sdlc/definicion-de-hecho.md) |
| Diseño | [Arquitectura C4](docs/03-diseno/arquitectura.md) · [ADRs](docs/03-diseno/adr/) · [API](docs/architecture/api-contract.md) · [Plantilla](docs/architecture/template-model.md) |
| Testing | [STLC](docs/04-testing/stlc.md) · [Estrategia](docs/04-testing/estrategia-de-pruebas.md) · [Plan IEEE 829](docs/04-testing/plan-de-pruebas-IEEE-829.md) · [Casos](docs/04-testing/casos-de-prueba.md) · [RTM](docs/04-testing/matriz-trazabilidad-RTM.md) |
| Operación | [Despliegue](docs/05-operacion/despliegue.md) · [Manual de usuario](docs/05-operacion/manual-usuario.md) · [Runbook](docs/05-operacion/runbook.md) |

## Testing
| Suite | Comando |
|---|---|
| Backend completo | `cd backend; pytest` |
| Por tipo | `pytest -m unit` · `integration` · `api` · `contract` · `security` · `regression` · `perf` |
| Sin lentas | `pytest -m "not slow"` |
| Por requisito | archivos listados en la [RTM](docs/04-testing/matriz-trazabilidad-RTM.md) (tests marcados `@pytest.mark.req("RF-xx")`) |
| Carga | `locust -f tests/performance/locustfile.py --host http://localhost:8000` |
| Frontend | `cd frontend; npm test` · `npm run test:e2e` |

CI (GitHub Actions): `ci.yml` (lint, tipos, pruebas con cobertura, build, E2E, Docker), `codeql.yml`, `security.yml`
(pip-audit, npm audit, Bandit, gitleaks) y `release.yml` (tag `v*` → GHCR + GitHub Release).

## ⚠️ Datos confidenciales
Los reportes reales (`*.Pdf`, `*.xlsx` en la raíz) contienen datos de clientes: están excluidos por `.gitignore` y **nunca**
deben subirse al repositorio, a issues ni a PRs. Las pruebas usan datos sintéticos (`backend/tests/fixtures/generate_fixtures.py`).

## Contribuir
Ver [CONTRIBUTING](.github/CONTRIBUTING.md) y [SECURITY](.github/SECURITY.md). Licencia [MIT](LICENSE).
