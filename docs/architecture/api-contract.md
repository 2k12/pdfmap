# Contrato de la API REST v1

Base: `/api/v1` · JSON UTF-8 · Autenticación opcional con cabecera `X-API-Key` (si `PDFMAP_API_KEY` está definida).
Documentación interactiva generada por FastAPI: `/docs` (Swagger) y `/redoc`. Esquema: `/openapi.json`.

Errores: `{"detail": "mensaje"}` con códigos 400 (petición inválida), 401 (API key), 404, 409 (estado incompatible), 413 (archivo demasiado grande), 415 (tipo no soportado), 422 (validación).

## Salud
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/health` | `{"status":"ok","version":"1.0.0"}` |

## Subida por fragmentos (archivos pesados, reanudable)
| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/uploads` | `{"filename":"x.pdf","size":123456}` | `{"upload_id","chunk_size","total_chunks"}` |
| PUT | `/uploads/{upload_id}/chunks/{index}` | bytes crudos (`application/octet-stream`), índice base 0 | `{"received":n,"total_chunks":m}` |
| GET | `/uploads/{upload_id}` | – | `{"upload_id","filename","size","chunk_size","total_chunks","received":[0,1,...]}` |
| POST | `/uploads/{upload_id}/complete` | – | `FileOut` (comienza la extracción en segundo plano) |
| DELETE | `/uploads/{upload_id}` | – | 204 |

Subida simple (archivos pequeños): `POST /files` multipart con campo `file` → `FileOut`.

## Archivos
`FileOut`:
```json
{"id":"uuid","name":"reporte.pdf","size":5242880,"kind":"pdf|text","status":"extracting|ready|error",
 "progress":0.42,"pages":2000,"lines":110000,"error":null,"created_at":"2026-10-01T10:00:00Z",
 "extraction":{"char_width":4.2,"x_origin":19.5,"y_tolerance":4.87}}
```
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/files` | Lista `FileOut[]` (más reciente primero) |
| GET | `/files/{id}` | `FileOut` (consultar `progress` mientras `status=extracting`) |
| DELETE | `/files/{id}` | 204, borra archivo, líneas y trabajos |
| POST | `/files/{id}/extract` | `{"char_width"?,"x_origin"?,"y_tolerance"?}` re‑extrae con parámetros manuales → `FileOut` |
| GET | `/files/{id}/pages/{page}` | `{"page":1,"pages":2000,"lines":[{"n":1,"text":"..."}]}` |
| GET | `/files/{id}/search?pattern=..&mode=regex|contains&limit=50` | `{"matches":[{"page","n","text"}],"truncated":bool}` |

## Asistentes de mapeo
| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/mapping/suggest-regex` | `{"line":"01/02/2026  F-000123  COMERCIAL ANDES S.A. ...","tokens":2}` | `{"regex":"^\\d{2}/\\d{2}/\\d{4}\\s+F-\\d{6}"}` |
| POST | `/mapping/suggest-columns` | `{"lines":["..."],"min_gap":1}` | `{"segments":[{"start":0,"end":12,"type":"text"},{"start":16,"end":24,"type":"date","date_formats":["%d/%m/%Y"]},...]}` (último `end`=null) |
| POST | `/mapping/validate` | `{"template":Template}` | `{"valid":true,"errors":[]}` |
| POST | `/mapping/annotate` | `{"file_id","template","page"}` | `{"page","lines":[{"n","text","rule":"venta"|null,"values":{...},"errors":[]}]}` |
| POST | `/mapping/preview` | `{"file_id","template","max_pages":20,"limit":200}` | `{"columns":[{"id","header","type"}],"rows":[[...]],"stats":Stats}` |

`Stats`: `{"lines","rows","unmatched","rule_hits":{"regla":n},"error_count","errors":[{"page","line","rule","message"}],"checks_ok","checks_failed_count","checks_failed":[...]}`

Valores en filas: texto → string, número → number, entero → number, fecha → `"YYYY-MM-DD"`, vacío → `null`.

## Plantillas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/templates` | `[{"id","name","description","builtin","updated_at"}]` |
| GET | `/templates/{id}` | `Template` completo |
| POST | `/templates` | crea (cuerpo `Template` sin `id` o con id nuevo) → `Template` |
| PUT | `/templates/{id}` | actualiza (las `builtin` devuelven 403; clonar con POST) |
| DELETE | `/templates/{id}` | 204 |

## Trabajos (procesamiento completo en segundo plano)
`JobOut`:
```json
{"id","kind":"export","file_id","template_id":null,"status":"queued|running|done|error|cancelled",
 "progress":0.0,"message":"","stats":Stats|null,"formats":["xlsx","csv"],"rows":60000,
 "created_at","finished_at"}
```
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/jobs` | `{"file_id","template_id"? , "template"?, "formats":["xlsx"]}` → `JobOut` (202) |
| GET | `/jobs?file_id=` | `JobOut[]` |
| GET | `/jobs/{id}` | `JobOut` |
| GET | `/jobs/{id}/rows?offset=0&limit=100` | `{"columns":[...],"rows":[[...]],"total":60000}` |
| GET | `/jobs/{id}/download?format=xlsx|csv` | archivo |
| POST | `/jobs/{id}/cancel` | `JobOut` |

## Modelo `Template`
Ver [template-model.md](template-model.md).
