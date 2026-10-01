# Pruebas exploratorias — charters y checklist

Sesiones de 60–90 minutos (session-based testing). Registrar: charter, tester, duración, notas, defectos (`DEF-xxx`) y preguntas.

## Charters
| ID | Charter | Requisitos |
|---|---|---|
| EX-01 | Explorar la **subida** de archivos grandes con cortes de red (desactivar el Wi‑Fi a mitad), recargando la página y reanudando | RF-01, RF-02 |
| EX-02 | Explorar la **extracción** con PDFs de distintos orígenes (Word→PDF, impresora virtual, reportes ERP, fuentes proporcionales) | RF-04 |
| EX-03 | Explorar la **creación de reglas** en un formato desconocido sin manual, midiendo la intuición del flujo | RF-07, RF-08, RNF-04 |
| EX-04 | Explorar **conversiones** con montos europeos, negativos, monedas y fechas ambiguas (01/02/03) | RF-09 |
| EX-05 | Explorar **jerarquías**: varios niveles de contexto, `clears` y `append` | RF-10 |
| EX-06 | Explorar el **diseñador Excel** solo con teclado y con lector de pantalla (NVDA) | RF-11, RNF-05 |
| EX-07 | Explorar la **concurrencia**: dos pestañas procesando y cancelando a la vez; eliminar un archivo durante el proceso | RF-14, RF-18 |
| EX-08 | Explorar **entradas maliciosas**: nombres con unicode/rutas, regex extremas, JSON de plantilla manipulado | RNF-03 |

## Checklist general
### Carga
- [ ] Arrastrar varios archivos a la vez
- [ ] Archivo con nombre unicode, espacios y mayúsculas en la extensión (`.Pdf`)
- [ ] Archivo de 0 bytes y archivo justo en el límite
- [ ] PDF protegido con contraseña / PDF escaneado
- [ ] Recargar el navegador durante la subida

### Visor y mapeo
- [ ] Líneas muy largas (> 250 caracteres): scroll horizontal y regla
- [ ] Arrastrar de derecha a izquierda para crear un campo
- [ ] Campos superpuestos o fuera de la línea
- [ ] Regex sugerida demasiado amplia o estricta; ajuste de tokens
- [ ] Cambiar el orden de las reglas y verificar "la primera gana"
- [ ] Zoom del navegador al 200 % (alineación de la cuadrícula)

### Excel
- [ ] Encabezados duplicados o vacíos
- [ ] Columna sin fuentes
- [ ] Totales en columnas de texto
- [ ] Abrir el XLSX en Excel y LibreOffice: formatos, filtros, panel congelado, fila TOTAL

### Robustez
- [ ] Reiniciar el backend con un trabajo en curso
- [ ] Disco lleno (simulado) durante la exportación
- [ ] Respuestas lentas (DevTools throttling) en la vista previa

## Registro de sesión (plantilla)
```
Charter: EX-0X
Tester:            Fecha:            Duración:
Build/commit:
Áreas cubiertas:
Notas / observaciones:
Defectos: DEF-
Preguntas / riesgos:
```
