# Modelo de plantilla de mapeo

Una **plantilla** describe cómo convertir un reporte (PDF o TXT) de formato desconocido en un Excel.
El extractor convierte cada página en **líneas de texto de ancho fijo** (cuadrícula de caracteres),
por lo que las posiciones de los campos se expresan en **columnas de carácter** (índice base 0, `end` exclusivo).

```jsonc
{
  "id": "uuid",                       // asignado por el servidor
  "name": "Ventas por vendedor",
  "description": "",
  "version": 1,
  "rules": [Rule, ...],               // se evalúan en orden: la primera que coincide gana
  "columns": [Column, ...],           // orden = orden de columnas en el Excel
  "options": {
    "sheet_name": "Datos", "totals_row": true, "freeze_header": true,
    "autofilter": true, "header_color": "1F4E78", "csv_delimiter": ";"
  }
}
```

## Rule
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string `^[a-z][a-z0-9_]{0,39}$` | identificador; se usa en las fuentes `regla.campo` |
| `name` | string | nombre visible |
| `color` | `#rrggbb` | color para resaltar en el mapeador visual |
| `enabled` | bool (true) | |
| `action` | `row` \| `context` \| `row_context` \| `append` \| `check` \| `skip` | ver abajo |
| `match` | `{"type":"regex"\|"starts_with"\|"contains"\|"always","value":"...","ignore_case":false}` | cómo reconocer la línea |
| `fields` | Field[] | campos que extrae |
| `clears` | string[] | ids de reglas de contexto que se borran cuando esta coincide |
| `check` | `{"group":"vendedor","compare":[{"field":"total","sum_of":"total"}],"tolerance":"0.00"}` | solo `action=check` |

Acciones:
- **row**: la línea genera una fila.
- **context**: sus campos se recuerdan y se copian a las filas siguientes (encabezados de grupo: vendedor, cliente, sucursal...).
- **row_context**: genera fila *y* queda como contexto (p. ej. una factura cuyos pagos vienen debajo).
- **append**: concatena sus campos de texto al campo `target` (o mismo `key`) de la fila anterior (descripciones en varias líneas).
- **check**: compara números impresos (totales) contra la suma de columnas (`sum_of` = id de columna) acumulada desde que coincidió la regla `group`. Los descuadres se reportan en `stats.checks_failed`.
- **skip**: consume la línea (encabezados de página, pies).

Las líneas que no coinciden con ninguna regla se ignoran (se cuentan en `stats.unmatched`).

## Field
| Campo | Tipo | Descripción |
|---|---|---|
| `key` | string `^[a-z][a-z0-9_]{0,39}$` | único en la regla |
| `label` | string | |
| `start`, `end` | int, int\|null | rango de columnas (end exclusivo; `null` = hasta el final de la línea) |
| `group` | string | alternativa a start/end: grupo con nombre de la regex de `match` |
| `constant` | string | alternativa: valor fijo (p. ej. "Venta") |
| `type` | `text` \| `number` \| `integer` \| `date` | |
| `decimal` | `"."` \| `","` | separador decimal para `number` |
| `date_formats` | string[] | formatos `strftime` (`%d/%m/%Y`); vacío = detección automática |
| `required` | bool | si está vacío, la regla **no** coincide (sirve para distinguir tipos de línea) |
| `default` | string | valor si está vacío |
| `null_values` | string[] | textos que se tratan como vacío (p. ej. `N/D`, `---`) |
| `target` | string | solo `append`: campo destino de la fila anterior |

## Column
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | identificador (lo usan `check.compare.sum_of`) |
| `header` | string | encabezado en el Excel |
| `sources` | string[] | `regla.campo` o metadatos `@page`, `@line`, `@rule`, `@raw` |
| `enabled` | bool | |
| `width` | number | ancho de columna en Excel |
| `number_format` | string | formato Excel (`#,##0.00`, `dd/mm/yyyy`); por defecto según tipo |
| `total` | bool | añade SUBTOTAL en la fila de totales |

**Resolución de valores**: si alguna fuente pertenece a la regla que generó la fila, se toma de ahí
(aunque esté vacía); si no, se toma el primer valor no nulo del contexto en el orden de `sources`.

Ejemplo completo: la plantilla precargada `builtin-ventas-ejemplo` (`backend/app/templates_builtin/ventas_ejemplo.json`, misma definición que `backend/tests/fixtures/ventas_template.json`).
