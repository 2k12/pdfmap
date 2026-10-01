# Scripts de GitHub

Inicializan un repositorio **ya creado** con la estructura de gestión del proyecto:

| Elemento | Origen |
|---|---|
| Etiquetas (`type/*`, `priority/*`, `area/*`, `test/*`, `status/*`) | `.github/labels.yml` |
| Hitos: v0.1 MVP extracción, v0.2 Mapeo visual, v0.3 Diseño Excel, v1.0 Release | definidos en el script |
| Un issue por requisito `[RF-xx]` / `[RNF-xx]` con prioridad, área e hito | `requirements.tsv` |

Los scripts son **idempotentes**: las etiquetas se actualizan (`--force`) y no se duplican hitos ni issues existentes (se busca `[ID]` en el título).

## Requisitos
- [GitHub CLI](https://cli.github.com/) autenticada: `gh auth status`.
- El repositorio debe existir (por ejemplo: `gh repo create 2k12/pdfmap --private --source . --push`).

## Uso

PowerShell (Windows):
```powershell
.\scripts\github\bootstrap.ps1 -DryRun                  # ver qué haría
.\scripts\github\bootstrap.ps1                          # repo del directorio actual
.\scripts\github\bootstrap.ps1 -Repo 2k12/pdfmap
```

Bash (Linux/macOS/Git Bash):
```bash
bash scripts/github/bootstrap.sh --dry-run
bash scripts/github/bootstrap.sh 2k12/pdfmap
```

## Después del bootstrap (manual en GitHub)
1. **Settings → Branches**: proteger `main` (PR obligatorio, 1 aprobación, checks `backend`, `frontend`, `e2e`, `docker`, `CodeQL`, `security`; historial lineal).
2. **Settings → Code security**: activar Dependabot alerts, secret scanning y push protection.
3. **Projects**: crear un tablero "PDFMap" (Backlog → Ready → In progress → In review → Done) y añadir los issues.
4. **Settings → Actions → General**: permisos de escritura de `GITHUB_TOKEN` para `release.yml` (publicación en GHCR).
