# Runbook — diagnóstico y solución de problemas

| Síntoma | Causa probable | Diagnóstico | Solución |
|---|---|---|---|
| Archivo en `error`: "El PDF no contiene texto extraíble" | PDF escaneado (imagen) | Intentar seleccionar texto en un visor de PDF | **No soportado** en v1.0. Alternativa: aplicar OCR externo (p. ej. `ocrmypdf`) y volver a cargar. OCR integrado en el roadmap |
| Columnas desalineadas / caracteres desplazados | Fuente proporcional o `char_width` mal calibrado | Ver `extraction.char_width` en el archivo; comparar con el ancho real (Courier: 0,6 × tamaño de fuente) | Re‑extraer con `char_width` manual (`POST /files/{id}/extract`). Para texto variable usar campos por **grupo regex** |
| Dos líneas del PDF salen fusionadas en una | `y_tolerance` demasiado alta | Comparar con el PDF | Re‑extraer con un `y_tolerance` menor (p. ej. 1.5) |
| Una línea sale partida en dos | `y_tolerance` demasiado baja (superíndices, fuentes mixtas) | | Aumentar `y_tolerance` |
| 413 al subir | Supera `PDFMAP_MAX_UPLOAD_MB` | | Aumentar la variable y reiniciar |
| 415 al completar | Extensión o firma no válidas | `head -c 5 archivo` ≠ `%PDF-` | Verificar que es un PDF real |
| Subida detenida | Red / proxy | Consola del navegador | **Reanudar** (consulta `GET /uploads/{id}`); revisar `client_max_body_size` del proxy ≥ tamaño de fragmento |
| Trabajo en `error` "interrumpido" | El servidor se reinició durante el proceso | Logs de arranque | Volver a lanzar el trabajo |
| `database is locked` en logs | Escrituras concurrentes intensas | | Reducir `PDFMAP_WORKERS`; verificar que `DATA_DIR` no está en una unidad de red |
| Vista previa lenta | Regex costosa (backtracking) | Probar la regex en la búsqueda | Anclar con `^`, evitar `(.*)*`; usar tipos de match `starts_with`/`contains` |
| Muchos "no reconocidas" | Faltan reglas | Contador `unmatched` y búsqueda | Crear reglas `skip` para encabezados y pies, o reglas nuevas |
| Descuadres en `checks_failed` | Faltan filas (regla demasiado estricta) o campos mal delimitados | Ir a la página/línea del descuadre | Ajustar la regla/campo; revisar `required`; verificar `group` del control |
| Fechas nulas con error | Formato no coincide | `stats.errors` | Definir `date_formats` explícitos |
| Números ×1000 o /1000 | Separador decimal incorrecto | | Ajustar `decimal` a `,` o `.` |
| 401 en todas las rutas | `PDFMAP_API_KEY` definida | | Enviar la cabecera `X-API-Key` (configurarla en el frontend) |
| Disco lleno | Salidas y archivos acumulados | Tamaño de `DATA_DIR` | Eliminar archivos antiguos desde la UI (RF-18) |

## Comandos útiles
```powershell
# Salud
curl http://localhost:8000/api/v1/health
# Ver estado de un archivo
curl http://localhost:8000/api/v1/files/<id>
# Re-extraer con calibración manual
curl -X POST http://localhost:8000/api/v1/files/<id>/extract -H "Content-Type: application/json" -d '{"char_width":4.2,"y_tolerance":2}'
# Logs (Docker)
docker compose logs -f backend
```

## Escalamiento
1. Reproducir con un **fixture sintético** (nunca adjuntar datos reales).
2. Abrir un issue con la plantilla **Defecto (IEEE 1044)**, adjuntando la plantilla JSON y los parámetros de extracción.
