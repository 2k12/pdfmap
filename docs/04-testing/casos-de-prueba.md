# Especificación de casos de prueba

Convenciones: **Tipo** U=unitaria, I=integración, A=API/funcional, C=contrato, R=regresión, E=E2E, P=rendimiento, L=carga,
S=seguridad, X=accesibilidad, M=manual/exploratoria. **Prioridad** A=alta, M=media, B=baja.
Rutas relativas a `backend/tests/` (Python) o `frontend/` (TS). Los nombres de archivo son los de referencia de la suite;
si un archivo cambia de nombre, actualiza esta tabla y la [RTM](matriz-trazabilidad-RTM.md) en el mismo PR.

## Carga y subida (RF-01, RF-02, RF-03)

| ID | Req | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|---|---|
| TC-001 | RF-01 | E | App abierta | Arrastrar un PDF a la zona de carga | `sample_report.pdf` | Barra de progreso; archivo listado con estado "extrayendo" y luego "listo" | A | Sí · `frontend/e2e/mapping.spec.ts` |
| TC-002 | RF-01 | U | – | Montar `Dropzone` y simular `drop` de un `.txt` | `reporte.txt` | Se llama a `onFiles` con el archivo | A | Sí · `frontend/tests/component/FilesPage.test.tsx` |
| TC-003 | RF-01 | U | – | Soltar un `.docx` | `x.docx` | Mensaje "Tipo de archivo no soportado"; sin petición HTTP | A | Sí · `frontend/tests/component/FilesPage.test.tsx` |
| TC-004 | RF-02 | A | API activa | `POST /uploads`, `PUT` de todos los fragmentos, `complete` | 3 fragmentos (chunk de 1 KB en la prueba) | `FileOut`; SHA‑256 igual al original | A | Sí · `api/test_uploads_api.py` |
| TC-005 | RF-02 | A | Upload iniciado | Enviar fragmentos en orden 2,0,1 | idem | Archivo íntegro (escritura por offset) | A | Sí · `api/test_uploads_api.py` |
| TC-006 | RF-02 | A | Fragmentos 0..1 de 3 subidos | `GET /uploads/{id}` | – | `received=[0,1]` | A | Sí · `api/test_uploads_api.py` |
| TC-007 | RF-02 | A | Falta el fragmento 2 | `POST complete` | – | 409 con los faltantes | A | Sí · `api/test_uploads_api.py` |
| TC-008 | RF-02 | A | Upload iniciado | `PUT chunks/-1` y `chunks/{total}` | – | 400 / 422 | M | Sí · `api/test_uploads_api.py` |
| TC-009 | RF-02 | U | – | Uploader con un fallo de red simulado en el fragmento 1 | mock fetch | Reintenta y completa; progreso 100 % | A | Sí · `frontend/tests/unit/uploader.test.ts` |
| TC-010 | RF-03 | S | – | Subir `falso.pdf` con contenido de texto | bytes `hola` | 415; temporal eliminado | A | Sí · `security/test_api_security.py` |
| TC-011 | RF-03 | S | `MAX_UPLOAD_MB=1` | `POST /uploads size=1 MB + 1` | – | 413 | A | Sí · `security/test_api_security.py` |
| TC-012 | RF-03 | S | – | Nombre `../../evil.pdf` | PDF válido | Nombre sanitizado; nada fuera de `DATA_DIR` | A | Sí · `security/test_api_security.py` |
| TC-013 | RF-03 | A | – | Subida simple de un archivo de 0 bytes | vacío | 400/415 | M | Sí · `api/test_files_api.py` |

## Extracción y visualización (RF-04, RF-05, RF-06)

| ID | Req | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|---|---|
| TC-014 | RF-04 | U | – | `layout_chars` con glifos en x=20, 24.2, 28.4 | chars sintéticos | `"ABC"` en columnas 0,1,2 | A | Sí · `unit/test_extraction_layout.py` |
| TC-015 | RF-04 | U | – | Dos glifos que caen en la misma columna | colisión | Ningún carácter perdido (el segundo se desplaza) | A | Sí · `unit/test_extraction_layout.py` (hypothesis) |
| TC-016 | RF-04 | I | Fixture Courier 7 pt | Abrir `PdfExtractor` | `sample_report.pdf` | `char_width≈4.2`; líneas iguales a las del generador | A | Sí · `integration/test_pdf_pipeline.py` |
| TC-017 | RF-04 | I | – | Extraer un PDF sin texto | `blank.pdf` | Estado `error` "sin texto extraíble" | A | Sí · `integration/test_pdf_pipeline.py` |
| TC-018 | RF-04 | A | Archivo listo | `POST /files/{id}/extract {char_width:5}` | – | `extraction.char_width=5`; líneas regeneradas | M | Sí · `api/test_files_api.py` |
| TC-019 | RF-04 | U | – | `TextExtractor` con `\f` y tabs | `multi.txt` | 2 páginas; tabs expandidos | M | Sí · `unit/test_extraction_layout.py` |
| TC-020 | RF-05 | A | Archivo listo | `GET /files/{id}/pages/1` y `/pages/{pages}` | – | 200 con `lines[n,text]` | A | Sí · `api/test_files_api.py` |
| TC-021 | RF-05 | A | Archivo listo | `GET /pages/0` y `/pages/{pages+1}` | – | 404 | M | Sí · `api/test_files_api.py` |
| TC-022 | RF-06 | A | Archivo listo | `search?pattern=Total vendedor:&mode=contains` | – | Coincidencias con página y n | M | Sí · `api/test_files_api.py` |
| TC-023 | RF-06 | S | Archivo listo | `search?pattern=([` | – | 400 "Expresión regular inválida" | M | Sí · `security/test_api_security.py` |
| TC-024 | RF-06 | S | Archivo listo | Regex de 501 caracteres | – | 422 | M | Sí · `security/test_api_security.py` |

## Mapeo: reglas, campos, tipos y acciones (RF-07 … RF-10)

| ID | Req | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|---|---|
| TC-025 | RF-07 | U | – | `suggest_regex("01/02/2026  F-000123  COMERCIAL ANDES S.A. …", 2)` | – | Regex que coincide con la línea y con otras ventas, no con líneas de nota o total | A | Sí · `unit/test_patterns.py` |
| TC-026 | RF-07 | U | – | Propiedad: `re.search(suggest_regex(l), l)` | líneas aleatorias (hypothesis) | Siempre coincide | A | Sí · `unit/test_patterns.py` |
| TC-027 | RF-07 | E | Archivo listo | Clic en una línea → "Crear regla" | fixture | Regla creada; líneas coincidentes coloreadas | A | Sí · `frontend/e2e/mapping.spec.ts` |
| TC-028 | RF-08 | U | – | `suggest_columns` sobre las líneas de detalle | fixture | Segmentos con tipos date/number/integer/text; último `end=null` | A | Sí · `unit/test_patterns.py` |
| TC-029 | RF-08 | U | – | Arrastrar con el puntero de la col 41 a la 54 en `GridViewer` | – | `onFieldCreate({start:41,end:54})` | A | Sí · `frontend/tests/component/MapperPage.test.tsx` |
| TC-030 | RF-08 | U | – | `pixelToColumn` con distintos anchos | – | Columna correcta en los límites | M | Sí · `frontend/tests/unit/lib.test.ts` |
| TC-031 | RF-09 | U | – | `to_number` con clases válidas | `1,234.56`, `(5)`, `5-`, `.00`, `$ 10` | 1234.56, −5, −5, 0, 10 | A | Sí · `unit/test_converters.py` |
| TC-032 | RF-09 | U | – | `to_number(decimal=",")` | `1.234,56` | 1234.56 | A | Sí · `unit/test_converters.py` |
| TC-033 | RF-09 | U | – | `to_number` inválidos | `abc`, `1.2.3`, `NaN` | `ConversionError` | A | Sí · `unit/test_converters.py` |
| TC-034 | RF-09 | U | – | `to_date` con formato explícito y automático | `21/01/01`, `2021-01-31` | Fechas correctas; `21/13/01` → error | A | Sí · `unit/test_converters.py` |
| TC-035 | RF-09 | U | – | `null_values`, `default`, `required` | – | nulo / defecto / la regla no coincide | A | Sí · `unit/test_engine.py` |
| TC-036 | RF-10 | U | – | context + 2 rows | líneas sintéticas | 2 filas con datos de contexto | A | Sí · `unit/test_engine.py` |
| TC-037 | RF-10 | U | – | `append` tras una fila | líneas de continuación | Texto concatenado con espacio | M | Sí · `unit/test_engine.py` |
| TC-038 | RF-10 | U | – | `clears` | vendedor nuevo | No se hereda el contexto anterior | A | Sí · `unit/test_engine.py` |
| TC-039 | RF-10 | U | – | Dos reglas que coinciden con la misma línea | – | Gana la primera en orden | A | Sí · `unit/test_engine.py` |
| TC-040 | RF-10 | U | – | Tabla de decisión de resolución de columnas (4 casos) | – | Según la [estrategia](estrategia-de-pruebas.md#tablas-de-decisión--resolución-de-columnas) | A | Sí · `unit/test_engine.py` |

## Diseño Excel, vista previa y plantillas (RF-11, RF-12, RF-13)

| ID | Req | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|---|---|
| TC-041 | RF-11 | U | – | Reordenar columnas con dnd-kit (teclado: espacio, flechas, espacio) | 3 columnas | Nuevo orden en el estado | A | Sí · `frontend/tests/component/DesignerPanel.test.tsx` |
| TC-042 | RF-11 | E | Plantilla con columnas | Arrastrar "Saldo" a la primera posición y procesar | fixture | Columna A del XLSX = "Saldo" | A | Sí · `frontend/e2e/mapping.spec.ts` |
| TC-043 | RF-12 | A | Archivo listo | `POST /mapping/preview` | plantilla de ejemplo de ventas | `columns`, `rows`, `stats` coherentes | A | Sí · `api/test_mapping_api.py` |
| TC-044 | RF-12 | A | – | `POST /mapping/validate` con una plantilla inválida | regex rota, fuente inexistente | `valid=false` con errores | A | Sí · `api/test_mapping_api.py` |
| TC-045 | RF-12 | P | Archivo de 20 páginas | Medir el tiempo de `preview` | fixture | < 2 s | M | Sí · `performance/test_performance.py` |
| TC-046 | RF-13 | A | – | CRUD de plantilla | plantilla mínima | 201/200/204; listado actualizado | A | Sí · `api/test_templates_api.py` |
| TC-047 | RF-13 | A | – | `PUT` sobre la plantilla precargada | `builtin-ventas-ejemplo` | 403 | A | Sí · `api/test_templates_api.py` |
| TC-048 | RF-13 | E | – | Exportar JSON → importar | – | Plantilla equivalente | M | Sí · `frontend/tests/component/TemplatesPage.test.tsx` |

## Procesamiento, exportación, cuadre y resultados (RF-14 … RF-18)

| ID | Req | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|---|---|
| TC-049 | RF-14 | A | Archivo listo | `POST /jobs` y polling | plantilla de ejemplo de ventas | `queued→running→done`; progreso monótono | A | Sí · `api/test_jobs_api.py` |
| TC-050 | RF-14 | I | Trabajo largo | Cancelar | fixture grande | `cancelled` ≤ 2 s; sin salida descargable | A | Sí · `integration/test_services.py` |
| TC-051 | RF-14 | I | Trabajo `running` en BD | Reiniciar el servicio | – | Marcado `error` "interrumpido" | M | Sí · `integration/test_services.py` |
| TC-052 | RF-15 | U | – | `ExcelExporter` con `max_rows_per_sheet=100` y 250 filas | – | 3 hojas; encabezado en cada una | A | Sí · `unit/test_exporters.py` |
| TC-053 | RF-15 | U | – | Tipos de celda | Decimal, datetime | Celdas numérica/fecha con formato | A | Sí · `unit/test_exporters.py` |
| TC-054 | RF-15 | A | Trabajo `done` | `download?format=csv` y `xlsx` | – | 200, `Content-Disposition`, CSV con BOM | A | Sí · `api/test_jobs_api.py` |
| TC-055 | RF-16 | R | – | Plantilla de ventas sobre el fixture sintético | `sample_report.pdf` | Filas y `stats` iguales al golden; `checks_failed_count=0` | A | Sí · `regression/test_golden.py` |
| TC-056 | RF-16 | U | – | Total alterado | líneas sintéticas | `checks_failed` con "impreso X vs calculado Y" | A | Sí · `unit/test_engine.py` |
| TC-057 | RF-17 | A | Trabajo `done` | `rows?offset=0&limit=1000`, `limit=1001`, offset > total | – | 200 / 422 / lista vacía | M | Sí · `api/test_jobs_api.py` |
| TC-058 | RF-18 | A | Archivo con trabajo | `DELETE /files/{id}` | – | 204; 404 posterior; directorios eliminados | A | Sí · `api/test_files_api.py` |

## No funcionales

| ID | Req | Tipo | Pasos | Resultado esperado | Prio | Auto / ubicación |
|---|---|---|---|---|---|---|
| TC-059 | RNF-01 | P | Extraer el PDF sintético de 2000 páginas | ≥ 40 pág/s | A | Sí · `performance/test_performance.py` (`slow`) |
| TC-060 | RNF-02 | P | Procesar 200 k filas midiendo la memoria pico (tracemalloc) | Crecimiento < 50 MB respecto a 20 k filas | A | Sí · `performance/test_performance.py` (`slow`) |
| TC-061 | RNF-01 | L | Locust: 20 usuarios consultando páginas/preview durante 5 min | p95 < 500 ms en páginas; 0 % de errores | M | Sí · `performance/locustfile.py` |
| TC-062 | RNF-03 | S | Con `API_KEY` definida: petición sin cabecera / con una clave errónea | 401 | A | Sí · `security/test_api_security.py` |
| TC-063 | RNF-03 | S | IDs no UUID / inexistentes en todas las rutas | 404/422, nunca 500 | A | Sí · `security/test_api_security.py` |
| TC-064 | RNF-03 | C | Schemathesis sobre `/openapi.json` | Sin errores 5xx; respuestas conformes | A | Sí · `contract/test_openapi_contract.py` |
| TC-065 | RNF-05 | X | axe sobre las páginas Carga, Mapeador y Trabajos | 0 violaciones serious/critical | A | Sí · `frontend/tests/a11y/a11y.test.tsx` |
| TC-066 | RNF-04 | M | Usuario nuevo crea una plantilla para un TXT simple siguiendo el manual | ≤ 15 min; SUS ≥ 70 | M | No · sesión moderada |
| TC-067 | RNF-07 | I | Suite completa en Windows y Ubuntu | Verde en ambos | M | Sí · matriz de `ci.yml` |
| TC-068 | RNF-08 | U | Montos con muchos decimales sumados | Exactitud Decimal (sin errores de float en los cuadres) | A | Sí · `unit/test_engine.py` |
| TC-069 | RNF-09 | S | gitleaks + verificación de que no hay `*.pdf` fuera de `backend/tests/fixtures` en git | Sin hallazgos | A | Sí · `security.yml` |
| TC-070 | RNF-06 | – | Cobertura en CI | backend ≥ 80 %, frontend ≥ 70 % | A | Sí · `ci.yml` |
