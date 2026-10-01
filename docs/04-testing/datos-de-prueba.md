# Datos de prueba

## Política (RNF-09)
- **Prohibido** usar o versionar datos reales de clientes. Los reportes reales de clientes
  (`*.pdf`, `*.xlsx` en la raíz del proyecto) son **confidenciales**, están en `.gitignore` y nunca se suben a GitHub, a issues, a PRs ni a artefactos de CI.
- Las evidencias de defectos usan fixtures sintéticos o extractos anonimizados (nombres, direcciones y teléfonos ficticios).
- gitleaks y una verificación de CI fallan si aparece un PDF/XLSX fuera de `backend/tests/fixtures/`.

## Fixtures sintéticos
Ubicación: `backend/tests/fixtures/`. Se generan con `generate_fixtures.py`, que escribe PDFs **sin dependencias externas**
(PDF mínimo con fuente Courier estándar: a 7 pt cada carácter mide 0,6 × 7 = 4,2 pt, tamaño típico de reportes de impresora).

| Fixture | Contenido | Uso |
|---|---|---|
| `sample_report.pdf` | Reporte "ventas por vendedor" con encabezados de página, vendedores, ventas, notas y líneas `Total vendedor:` ficticios | Regresión (golden), E2E, API |
| `sample_report.txt` | Mismo contenido en texto con `\f` | TextExtractor, API |
| `proportional.pdf` | Texto en Helvetica (proporcional) | Robustez de `layout_chars` |
| `blank.pdf` | PDF sin capa de texto | Error "sin texto extraíble" |
| `fake.pdf` | Texto plano renombrado | Validación de firma (415) |
| `european.txt` | Montos `1.234,56`, fechas `dd.mm.yyyy` | Conversión con `decimal=","` |
| `ventas_template.json` | Plantilla de pruebas (misma definición que la precargada `builtin-ventas-ejemplo`) | Motor, API, regresión |
| `../regression/golden/ventas_sample.json` | Filas y estadísticas esperadas de la plantilla de ventas sobre `sample_report.pdf` | Regresión |

## Generación
```powershell
.\.venv\Scripts\Activate.ps1
cd backend
python tests\fixtures\generate_fixtures.py                      # fixtures estándar
python tests\fixtures\generate_fixtures.py --pages 20000 --out $env:TEMP\big.pdf   # PDF grande para rendimiento (RNF-01/02)
```
- `--pages N`: número de páginas (≈ 45 líneas por página).
- `--seed S`: semilla para datos reproducibles.
- Los PDFs grandes **no** se versionan: se generan en el job de rendimiento o en local.

## Actualizar golden files
Si un cambio intencional altera la salida:
```powershell
cd backend; pytest tests\regression --update-golden
```
Revisar el diff del JSON en el PR y justificarlo en la descripción.

## Datos para pruebas de límite
Los tamaños límite (0 B, `MAX`, `MAX + 1`) se crean en memoria en la propia prueba; con `PDFMAP_MAX_UPLOAD_MB` y
`PDFMAP_CHUNK_SIZE_MB` reducidos mediante `monkeypatch` para no escribir gigabytes.
