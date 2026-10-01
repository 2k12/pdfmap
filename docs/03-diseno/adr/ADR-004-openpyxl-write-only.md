# ADR-004: openpyxl en modo `write_only` para Excel en streaming

- **Estado**: Aceptado · **Fecha**: 2026-10-01 · **Requisitos**: RF-15, RNF-02

## Contexto
El prototipo inicial construía el libro completo en memoria (modo normal de openpyxl), aplicando formatos celda por celda al final.
Con cientos de miles de filas, el consumo de memoria crece linealmente (~1 KB o más por celda).

## Opciones
1. **openpyxl `write_only`** con `WriteOnlyCell` para estilos.
2. XlsxWriter con `constant_memory` — muy eficiente, pero sin lectura (no necesaria) y con otra dependencia.
3. Solo CSV — pierde formatos, filtros y totales.

## Decisión
openpyxl `write_only` (ya era dependencia). Encabezado estilizado, `freeze_panes`, `auto_filter`, formatos por tipo de
columna y fila TOTAL con `SUBTOTAL(9, …)`. Al alcanzar 1.048.576 filas se crea una hoja nueva `Nombre (n)`.
CSV como salida adicional (UTF‑8 con BOM).

## Consecuencias
- ✅ Memoria constante independiente del número de filas.
- ⚠️ No se puede volver atrás a modificar celdas: los anchos y el panel congelado se fijan antes de escribir, y los totales al cerrar la hoja.
- ⚠️ Un formato por celda tiene coste de CPU; aceptable (≈ 62 k filas × 20 columnas en segundos).
