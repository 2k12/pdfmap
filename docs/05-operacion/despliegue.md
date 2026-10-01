# Despliegue

## Requisitos
- Python ≥ 3.12 (probado con 3.14), Node.js ≥ 20, Git. Opcional: Docker ≥ 24.
- **Nunca** instalar dependencias de Python globalmente: siempre dentro de `.venv`.

## Local (Windows / PowerShell)

### Backend
```powershell
# Desde la raíz del proyecto (se reutiliza el .venv de la raíz)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt     # o requirements.txt solo para ejecutar
cd backend
uvicorn app.main:app --reload --port 8000
```
API en `http://localhost:8000/api/v1`, Swagger en `http://localhost:8000/docs`.

### Frontend
```powershell
cd frontend
npm ci
npm run dev        # http://localhost:5173 (proxy /api → :8000)
```

### Linux / macOS
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend && uvicorn app.main:app --reload
```

## Docker Compose
```powershell
docker compose up --build
```
- `frontend`: nginx sirviendo la SPA en `http://localhost:8080` y proxy de `/api` al backend.
- `backend`: Uvicorn en el puerto 8000 con el volumen `pdfmap-data` montado en `/data`.

## Variables de entorno

| Variable | Defecto | Descripción |
|---|---|---|
| `PDFMAP_DATA_DIR` | `./data` (`/data` en Docker) | Directorio de la BD SQLite, subidas, archivos y salidas |
| `PDFMAP_MAX_UPLOAD_MB` | `2048` | Tamaño máximo de archivo (RF-02/RF-03) |
| `PDFMAP_CHUNK_SIZE_MB` | `8` | Tamaño de fragmento de subida |
| `PDFMAP_API_KEY` | *(vacío)* | Si se define, todas las rutas excepto `/health` exigen la cabecera `X-API-Key` |
| `PDFMAP_CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Orígenes permitidos, separados por coma |
| `PDFMAP_WORKERS` | `2` | Hilos de trabajo para extracción/exportación |

Ejemplo `.env` (no versionado):
```
PDFMAP_DATA_DIR=D:\pdfmap-data
PDFMAP_MAX_UPLOAD_MB=4096
PDFMAP_API_KEY=cambia-esto
```

## Producción (recomendaciones)
- Proxy inverso con HTTPS (nginx/Caddy) y `client_max_body_size` ≥ `CHUNK_SIZE_MB`.
- Definir `PDFMAP_API_KEY` y restringir `PDFMAP_CORS_ORIGINS`.
- Respaldar `PDFMAP_DATA_DIR` si las plantillas son valiosas (`pdfmap.db`); los archivos subidos pueden purgarse.
- Sonda de salud: `GET /api/v1/health`.

## Releases
1. Actualizar `CHANGELOG.md` (mover *Unreleased* a la versión).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `release.yml` construye y publica `ghcr.io/<owner>/pdfmap-backend:X.Y.Z` y `pdfmap-frontend:X.Y.Z` y crea el GitHub Release.
4. Smoke post‑release: `docker compose pull && docker compose up -d` y `GET /api/v1/health`.
