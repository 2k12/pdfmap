# Historias de usuario

Estimación en puntos de historia (Fibonacci). Prioridad MoSCoW. Cada historia se convierte en un issue de GitHub
(`scripts/github/bootstrap.*`) con la etiqueta `type/feature` y el hito indicado.

| ID | Historia | Req. | Pts | Prioridad | Hito |
|---|---|---|---|---|---|
| HU-01 | Como analista quiero **arrastrar un PDF** a la página para cargarlo sin usar la consola. | RF-01 | 3 | Must | v0.1 |
| HU-02 | Como analista quiero que la **subida de archivos de cientos de MB se reanude** si se corta la red. | RF-02 | 8 | Must | v0.1 |
| HU-03 | Como administrador quiero que **se rechacen archivos que no sean PDF/TXT reales** o demasiado grandes. | RF-03 | 3 | Must | v0.1 |
| HU-04 | Como usuario técnico quiero **ver el PDF como texto alineado en columnas** para identificar campos. | RF-04, RF-05 | 8 | Must | v0.1 |
| HU-05 | Como usuario técnico quiero **corregir la calibración** cuando las columnas salgan desalineadas. | RF-04 | 3 | Should | v0.2 |
| HU-06 | Como usuario técnico quiero **buscar** "Total vendedor:" o una regex en todo el archivo. | RF-06 | 3 | Should | v0.2 |
| HU-07 | Como usuario técnico quiero **crear una regla haciendo clic en una línea** y que se me sugiera el patrón. | RF-07 | 5 | Must | v0.2 |
| HU-08 | Como usuario técnico quiero **arrastrar sobre el texto para marcar un campo**. | RF-08 | 8 | Must | v0.2 |
| HU-09 | Como usuario técnico quiero **detectar columnas automáticamente** con su tipo. | RF-08 | 5 | Should | v0.2 |
| HU-10 | Como analista quiero que **montos y fechas se conviertan correctamente** (comas, paréntesis, negativos). | RF-09 | 5 | Must | v0.2 |
| HU-11 | Como usuario técnico quiero que **los datos del cliente se copien a cada factura** (contexto). | RF-10 | 5 | Must | v0.2 |
| HU-12 | Como usuario técnico quiero **unir descripciones partidas en varias líneas**. | RF-10 | 3 | Could | v0.3 |
| HU-13 | Como analista quiero **ordenar y renombrar las columnas del Excel arrastrándolas**. | RF-11 | 8 | Must | v0.3 |
| HU-14 | Como analista quiero **ver en vivo cómo queda el Excel** mientras edito. | RF-12 | 5 | Must | v0.3 |
| HU-15 | Como analista quiero **guardar la plantilla** y reutilizarla el próximo mes. | RF-13 | 5 | Must | v0.3 |
| HU-16 | Como analista quiero **procesar 2000 páginas sin bloquear la pantalla** y poder cancelar. | RF-14 | 8 | Must | v0.1 |
| HU-17 | Como analista quiero **descargar XLSX con formatos, filtros y totales** y también CSV. | RF-15 | 5 | Must | v0.3 |
| HU-18 | Como contador quiero **saber si los totales impresos cuadran** con lo extraído. | RF-16 | 5 | Should | v0.3 |
| HU-19 | Como analista quiero **ver los resultados paginados** antes de descargarlos. | RF-17 | 3 | Should | v1.0 |
| HU-20 | Como responsable de datos quiero **eliminar un archivo y todo lo derivado**. | RF-18 | 2 | Must | v1.0 |

## Criterios de aceptación detallados (selección)

### HU-02 — Subida reanudable
```gherkin
Escenario: Reanudar tras un corte
  Dado un archivo de 200 MB y fragmentos de 8 MB
  Y que se subieron los fragmentos 0 a 9
  Cuando la conexión se restablece y pulso "Reanudar"
  Entonces solo se envían los fragmentos 10 a 24
  Y el SHA-256 del archivo final coincide con el original
```

### HU-08 — Campo arrastrando
```gherkin
Escenario: Crear un campo de monto
  Dado la regla "Detalle de venta" activa y una línea coincidente visible
  Cuando arrastro desde la columna 41 hasta la 54
  Entonces se crea el campo "campo_1" con start=41 y end=54
  Y se muestra una banda de color en todas las líneas coincidentes
  Y la vista previa incluye la columna con los valores extraídos
```

### HU-11 — Contexto
```gherkin
Escenario: Heredar datos del vendedor
  Dado una regla "vendedor" con acción context
  Y una regla "venta" con acción row
  Cuando proceso un reporte con 1 vendedor y 3 ventas
  Entonces obtengo 3 filas con el mismo código de vendedor
```

### HU-18 — Cuadre
```gherkin
Escenario: Detectar un descuadre
  Dado la plantilla de ejemplo de ventas y un reporte con un total de vendedor alterado
  Cuando proceso el archivo
  Entonces stats.checks_failed_count = 1
  Y el detalle indica la página, la línea y "impreso X vs calculado Y"
```

**Total estimado**: 100 puntos ≈ 5 sprints de 2 semanas a ~20 puntos por sprint.
