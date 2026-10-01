# ADR-002: Cuadrícula de texto genérica en lugar de un parser fijo

- **Estado**: Aceptado · **Fecha**: 2026-10-01 · **Requisitos**: RF-04, RF-07, RF-08, RF-10

## Contexto
El prototipo inicial tenía las posiciones de columna, las regex y la lógica de agrupación **escritas en el código** para un único
reporte (Courier 7 pt, 4,2 pt por carácter). El requisito actual es que **no se conoce el formato** del PDF
que llegará y que el mapeo debe hacerse de forma gráfica.

## Opciones
1. **Cuadrícula de texto genérica + plantilla declarativa**: reconstruir cada página como líneas de ancho fijo con una
   calibración automática y describir la lógica con reglas (match, campos, acción).
2. Detección de tablas (pdfplumber/camelot): funciona con tablas con bordes, pero falla en reportes jerárquicos de
   impresora (encabezados de grupo, subtotales, filas de distinto tipo).
3. Un parser por formato en código: no escala y exige programar.
4. Modelos de ML/LLM: no deterministas, costosos y con riesgo de privacidad (RNF-09).

## Decisión
Opción 1. El extractor calibra `char_width` (mediana del ancho de glifo), `x_origin` y `y_tolerance` y coloca cada carácter
en su columna; si hay colisión (fuentes proporcionales) se desplaza a la derecha para **no perder caracteres**. Las reglas
se evalúan sobre esas líneas; los campos se expresan en columnas de carácter (lo que el usuario ve es exactamente lo que
extrae el motor: WYSIWYG).

## Consecuencias
- ✅ Un formato jerárquico completo (encabezado, vendedor, ventas, notas, totales) se expresa sin código como la plantilla `builtin-ventas-ejemplo`: 0 descuadres sobre el reporte sintético.
- ✅ Las líneas se extraen **una vez** y se cachean en SQLite; la vista previa y el reprocesamiento no vuelven a leer el PDF.
- ⚠️ Con fuentes proporcionales las posiciones son aproximadas → mitigación: re‑extracción manual y campos por grupo regex.
- ⚠️ No cubre PDFs escaneados (sin texto) → OCR fuera de alcance (ver runbook).
