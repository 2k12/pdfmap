# Arquitectura de PDFMap

Documentada con el modelo **C4**. Contratos detallados: [API](../architecture/api-contract.md) · [Plantilla](../architecture/template-model.md).

## Nivel 1 — Contexto

```mermaid
flowchart TB
  analista([Analista / Usuario técnico])
  integrador([Integrador / Script])
  sistema[["PDFMap<br/>Mapeador visual PDF/TXT → Excel"]]
  origen[(Sistema origen<br/>ERP / contable)]
  excel[(Excel / BI)]
  origen -- genera reportes PDF/TXT --> analista
  analista -- carga, mapea, descarga --> sistema
  integrador -- API REST --> sistema
  sistema -- XLSX / CSV --> excel
```

## Nivel 2 — Contenedores

```mermaid
flowchart LR
  browser([Navegador])
  subgraph PDFMap
    fe["Frontend SPA<br/>React + TS + Vite<br/>(nginx en Docker)"]
    api["Backend API<br/>FastAPI + Uvicorn<br/>/api/v1"]
    workers["Pool de trabajos<br/>ThreadPoolExecutor"]
    db[("SQLite (WAL)<br/>files, lines, templates,<br/>jobs, job_rows, uploads")]
    fs[("DATA_DIR<br/>uploads/ files/ outputs/")]
  end
  browser -->|HTTPS| fe
  fe -->|JSON / octet-stream| api
  api --> db
  api --> fs
  api -->|encola| workers
  workers --> db
  workers --> fs
```

## Nivel 3 — Componentes del backend

```mermaid
flowchart TB
  subgraph api["app/api (FastAPI)"]
    r_up[routes/uploads] --- r_files[routes/files]
    r_map[routes/mapping] --- r_tpl[routes/templates]
    r_jobs[routes/jobs] --- r_health[routes/health]
    deps[deps: API key, settings, db]
    schemas[schemas.py: validación Pydantic]
  end
  subgraph services["app/services"]
    storage[storage: rutas seguras, fragmentos]
    files_s[files: registro, extracción → líneas]
    jobs_s[jobs: cola, progreso, cancelación]
    tpl_s[templates: CRUD + precargadas]
    db_s[db: conexión SQLite, esquema]
  end
  subgraph core["app/core (puro, sin red)"]
    ext[extraction: PdfExtractor, TextExtractor, layout_chars]
    eng[mapping/engine: MappingEngine]
    conv[mapping/converters]
    pat[mapping/patterns: suggest_regex, suggest_columns, guess_type]
    exp[export: ExcelExporter, CsvExporter]
  end
  api --> services --> core
  eng --> conv
  r_map --> pat
```

Principio: `core` no conoce HTTP ni SQLite, por lo que es 100 % probable con pruebas unitarias y reutilizable desde una CLI.

## Componentes del frontend

```mermaid
flowchart LR
  App --> UploadPage[Carga: Dropzone + chunked uploader]
  App --> MapperPage[Mapeador]
  MapperPage --> GridViewer[Visor de cuadrícula + regla + selección por arrastre]
  MapperPage --> RulesPanel[Panel de reglas y campos]
  MapperPage --> ExcelDesigner[Diseñador de columnas dnd-kit]
  MapperPage --> PreviewTable[Vista previa + estadísticas]
  App --> JobsPage[Trabajos: progreso, descarga, resultados]
  subgraph lib
    apiClient[api client]
    store[estado de plantilla]
  end
```

## Secuencia — subida por fragmentos (RF-02)

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as Backend
  participant FS as DATA_DIR
  participant W as Worker
  UI->>API: POST /uploads {filename,size}
  API-->>UI: {upload_id, chunk_size, total_chunks}
  loop cada fragmento i (con reintentos)
    UI->>API: PUT /uploads/{id}/chunks/{i} (bytes)
    API->>FS: escribe en offset i*chunk_size
    API-->>UI: {received, total_chunks}
  end
  Note over UI,API: Si se corta: GET /uploads/{id} → received[] y se reenvían los faltantes
  UI->>API: POST /uploads/{id}/complete
  API->>FS: valida tamaño y firma %PDF-, mueve a files/{file_id}
  API->>W: encola extracción
  API-->>UI: FileOut {status: extracting}
  loop polling
    UI->>API: GET /files/{id}
    API-->>UI: progress 0..1
  end
  W->>W: calibra, extrae páginas, inserta líneas por lotes
  W-->>API: status=ready
```

## Secuencia — mapeo y procesamiento (RF-07…RF-16)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant ENG as MappingEngine
  participant W as Worker
  UI->>API: POST /mapping/suggest-regex {line}
  API-->>UI: {regex}
  UI->>API: POST /mapping/annotate {file_id, template, page}
  API->>ENG: evaluate(líneas de la página)
  API-->>UI: líneas con regla y valores
  UI->>API: POST /mapping/preview {file_id, template, max_pages:20}
  API->>ENG: process(líneas de 20 páginas)
  API-->>UI: columns, rows, stats
  UI->>API: POST /jobs {file_id, template, formats}
  API->>W: encola exportación
  W->>ENG: process(stream de todas las líneas)
  W->>W: ExcelExporter/CsvExporter.write(fila), job_rows por lotes, progreso
  UI->>API: GET /jobs/{id} ... done
  UI->>API: GET /jobs/{id}/download?format=xlsx
```

## Modelo de datos (SQLite)

```mermaid
erDiagram
  FILES ||--o{ LINES : contiene
  FILES ||--o{ JOBS : procesa
  TEMPLATES ||--o{ JOBS : usa
  JOBS ||--o{ JOB_ROWS : produce
  UPLOADS }o--|| FILES : "al completar crea"
  FILES { text id PK; text name; int size; text kind; text status; real progress; int pages; int lines; text error; text extraction_json; text sha256; text created_at }
  LINES { text file_id FK; int page; int n; text text }
  TEMPLATES { text id PK; text name; text data_json; int builtin; text created_at; text updated_at }
  JOBS { text id PK; text kind; text file_id FK; text template_id; text template_json; text status; real progress; text message; text stats_json; text formats; int rows; text created_at; text finished_at }
  JOB_ROWS { text job_id FK; int idx; text data_json }
  UPLOADS { text id PK; text filename; int size; int chunk_size; int total_chunks; text received_json; text created_at }
```
Índices: `lines(file_id, page, n)`, `job_rows(job_id, idx)`.

## Estructura de almacenamiento
```
DATA_DIR/
  pdfmap.db
  uploads/{upload_id}.part
  files/{file_id}/original.{pdf|txt}
  outputs/{job_id}/resultado.xlsx | resultado.csv
```

## Decisiones clave
Ver los [ADRs](adr/). En resumen: la **cuadrícula de texto genérica** (ADR-002) permite que todo el mapeo sea
declarativo; el **streaming** de extremo a extremo (ADR-004) mantiene la memoria constante; **SQLite + hilos**
(ADR-003) evita infraestructura adicional en un despliegue local con datos sensibles (RNF-09).

## Atributos de calidad → tácticas
| Atributo | Táctica |
|---|---|
| Rendimiento | Extracción una sola vez y caché de líneas en SQLite; lectura de texto completo de la página por llamada; inserción por lotes |
| Escalabilidad | Generadores en todo el pipeline; `write_only`; fragmentos con escritura por offset |
| Seguridad | UUID, rutas confinadas, validación Pydantic, API key, CORS, límites |
| Confiabilidad | WAL, estados persistentes, salidas atómicas, errores por línea no fatales |
| Mantenibilidad | Capas `api → services → core`, núcleo puro, contrato OpenAPI |
