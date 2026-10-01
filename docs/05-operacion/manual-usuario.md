# Manual de usuario

PDFMap convierte reportes PDF/TXT en Excel en cuatro pasos: **Cargar → Mapear → Diseñar Excel → Procesar**.

## 1. Cargar el archivo
1. Abre PDFMap en el navegador.
2. **Arrastra** el PDF a la zona "Suelta aquí tu archivo" o pulsa **Seleccionar archivo**.
3. Verás dos barras: **subida** (por fragmentos; si se corta la conexión pulsa **Reanudar**) y **extracción**.
4. Cuando el estado sea **Listo**, pulsa **Mapear**.

> Formatos: `.pdf` (con texto seleccionable), `.txt`, `.prn`, `.lst`. Los PDF escaneados (imagen) no son compatibles.

## 2. Mapear (reglas y campos)
El visor muestra la página como texto alineado, con una **regla de columnas** arriba y el número de línea a la izquierda.

### 2.1 Crear una regla
1. Haz clic en una línea representativa (por ejemplo, una factura).
2. Pulsa **Crear regla desde línea**. Se propone un patrón (por ejemplo `^[A-Z]{2}\d{10}`) y todas las líneas que coinciden se colorean.
3. Ajusta:
   - **Tokens**: cuántas "palabras" del inicio se usan en el patrón (más tokens = más estricto).
   - **Acción**:
     - *Fila*: cada línea es una fila del Excel.
     - *Contexto*: sus datos se copian a las filas siguientes (por ejemplo, el cliente).
     - *Fila + contexto*: ambas cosas (por ejemplo, una factura con pagos debajo).
     - *Anexar*: une el texto a la fila anterior (descripciones en varias líneas).
     - *Control*: compara totales impresos con la suma calculada.
     - *Ignorar*: no hace nada.
4. El **orden** de las reglas importa: gana la primera que coincide. Arrástralas para reordenarlas.

### 2.2 Definir campos
- **Arrastrando**: con la regla seleccionada, arrastra el ratón sobre una línea coloreada desde el inicio hasta el final del dato. Aparece una banda de color en todas las líneas de esa regla.
- **Detectar columnas**: el sistema propone automáticamente las columnas y su tipo; acepta las que quieras.
- **Por teclado**: escribe *Inicio* y *Fin* en el panel del campo.
- Configura el **nombre**, el **tipo** (texto, número, entero, fecha), el separador decimal, el formato de fecha (por ejemplo `%d/%m/%Y`), los valores nulos, el valor por defecto y **Obligatorio** (si está vacío, la línea no se considera de esta regla).

## 3. Diseñar el Excel
1. En **Columnas del Excel** pulsa **Agregar todos los campos** o agrega uno por uno.
2. **Arrastra** las columnas para ordenarlas (o usa el teclado: Tab hasta el asa, Espacio, flechas, Espacio).
3. Cambia el **encabezado**, el **ancho**, el **formato** y marca **Total** para sumar al final.
4. Una columna puede tener **varias fuentes** (por ejemplo "Factura" = `venta.factura` o `devolucion.factura`). También existen *Página*, *Línea*, *Regla* y *Texto original*.
5. La **vista previa** se actualiza sola y muestra las filas, cuántas líneas reconoció cada regla, los errores y los descuadres.
6. Pulsa **Guardar plantilla** para reutilizarla. Puedes **Exportar/Importar** el JSON.

## 4. Procesar y descargar
1. Elige **XLSX** y/o **CSV** y pulsa **Procesar archivo completo**.
2. Observa el progreso; puedes **Cancelar**.
3. Al terminar, **Descarga** los archivos y revisa los resultados en la tabla paginada.
4. Si hay errores o descuadres, haz clic en ellos para ir a la página y línea correspondientes.

---

## Ejemplo A: ventas por vendedor (plantilla incluida)
El reporte sintético de ejemplo se genera con `python tests\fixtures\generate_fixtures.py` (desde `backend/`) y tiene líneas como:
```
Vendedor: V001 ANA PEREZ                 Zona: NORTE
01/02/2026  F-000123  COMERCIAL ANDES S.A.           334    8,102.11
            Nota: entrega parcial 3
                              Total vendedor:        1234    56,789.10
```
1. Carga `backend/tests/fixtures/sample_report.pdf` (o el TXT equivalente).
2. En **Plantillas**, elige **"Ventas por vendedor (ejemplo)"**.
3. Verás 5 reglas: *Encabezado de página* (ignorar), *Vendedor* (contexto, azul), *Detalle de venta* (fila, verde), *Nota* (anexar a la venta anterior) y *Total vendedor* (control de cuadre de cantidad y total).
4. Pulsa **Procesar**. Resultado esperado: una fila por venta con el vendedor, su nombre y zona heredados, la nota anexada y todas las líneas `Total vendedor:` cuadradas (0 descuadres).
5. Para modificarla, pulsa **Clonar** (la plantilla incluida es de solo lectura).

## Ejemplo B: formato nuevo (inventario en TXT)
Supón un reporte:
```
BODEGA: 01 CENTRAL
  A-1001  TORNILLO 1/4         120    0,15    18,00
  A-1002  TUERCA 1/4            80    0,05     4,00
BODEGA: 02 NORTE
  B-2001  CLAVO 2"             500    0,02    10,00
```
1. Clic en `BODEGA: 01 CENTRAL` → **Crear regla** → acción **Contexto**; campo por arrastre sobre `01 CENTRAL` (nombre `bodega`).
2. Clic en `A-1001 …` → **Crear regla** (patrón `^\s*[A-Z]-\d{4}`) → acción **Fila**.
3. **Detectar columnas**: código (texto), descripción (texto), cantidad (entero), costo y total (número con decimal `,`).
4. En **Columnas**: Bodega, Código, Descripción, Cantidad, Costo, Total (con **Total** marcado).
5. **Procesar** → descarga el XLSX.

## Consejos
- Si las columnas aparecen desalineadas en un PDF, abre **Parámetros de extracción** y ajusta el *ancho de carácter* (ver el [runbook](runbook.md)).
- Las líneas sin regla se ignoran: revisa el contador "no reconocidas" en la vista previa para descubrir tipos de línea que faltan.
