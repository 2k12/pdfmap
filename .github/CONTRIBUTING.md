# Guía de contribución

¡Gracias por contribuir a PDFMap! Este proyecto sigue un SDLC iterativo con trazabilidad estricta entre requisitos, código y pruebas.

## Antes de empezar
1. Lee el [SRS](../docs/01-requisitos/SRS-IEEE-830.md) y la [arquitectura](../docs/03-diseno/arquitectura.md).
2. Busca o crea un **issue** con la plantilla adecuada (funcionalidad, bug, caso de prueba, defecto).
3. Verifica la [Definition of Ready](../docs/02-sdlc/definicion-de-hecho.md).

## Entorno (Windows / PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt   # SIEMPRE dentro del venv, nunca global
cd frontend; npm ci
```

## Flujo de trabajo
1. Rama desde `main`: `feature/RF-08-drag-fields`, `fix/DEF-012-...`, `test/...`, `docs/...`.
2. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(engine): soportar acción append (RF-10)`.
3. Código + **pruebas** marcadas (`@pytest.mark.req("RF-10")` / `it("[RF-10] ...")`) + documentación + RTM.
4. Ejecuta localmente:
   ```powershell
   cd backend; ruff check .; mypy app; pytest -m "not slow"
   cd ..\frontend; npm run lint; npm run typecheck; npm test; npm run build
   ```
5. Abre el PR con la plantilla completa y `Closes #n`.
6. CI verde + aprobación de CODEOWNERS → squash merge.

Detalle: [gestión de configuración](../docs/02-sdlc/gestion-configuracion.md).

## Reglas importantes
- 🔒 **Nunca** subas datos reales de clientes (PDF/Excel): usa fixtures sintéticos (`backend/tests/fixtures/generate_fixtures.py`).
- Las dependencias nuevas de Python van en `backend/requirements*.txt`; las de JS, en `frontend/package.json`.
- El núcleo `backend/app/core` debe seguir siendo puro (sin FastAPI ni SQLite).
- Los cambios en la API o en el esquema de plantilla actualizan `docs/architecture/*.md`.

## Estilo
- Python: ruff (PEP 8, isort), mypy, tipado en las firmas públicas, docstrings en español.
- TypeScript: `strict`, ESLint, componentes funcionales, accesibilidad (roles/labels).
