"""Escritura de Excel en modo streaming (openpyxl write_only): memoria constante con millones
de filas. Si se supera el límite de filas de Excel se crean hojas adicionales."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

EXCEL_MAX_ROWS = 1_048_576
DEFAULT_FORMATS = {"number": "#,##0.00", "integer": "0", "date": "dd/mm/yyyy"}


class ExcelExporter:
    def __init__(
        self,
        path: str | Path,
        columns: list[dict],
        options: dict | None = None,
        column_types: dict[str, str] | None = None,
        max_rows_per_sheet: int = EXCEL_MAX_ROWS,
    ) -> None:
        self.path = Path(path)
        self.columns = columns
        self.options = options or {}
        self.types = column_types or {}
        self.max_rows = max_rows_per_sheet - 2  # encabezado + fila de totales
        self.wb = Workbook(write_only=True)
        self.base_title = (self.options.get("sheet_name") or "Datos")[:28]
        self.sheet_rows = 0
        self.sheets = 0
        self.total_rows = 0
        self.formats = [self._format(c) for c in columns]
        self._new_sheet()

    def _format(self, col: dict) -> str | None:
        return col.get("number_format") or DEFAULT_FORMATS.get(self.types.get(col["id"], ""))

    def _new_sheet(self) -> None:
        if self.sheets:
            self._close_sheet()
        self.sheets += 1
        title = self.base_title if self.sheets == 1 else f"{self.base_title} ({self.sheets})"
        self.ws = self.wb.create_sheet(title=title)
        for i, col in enumerate(self.columns, start=1):
            self.ws.column_dimensions[get_column_letter(i)].width = col.get("width") or max(10, len(col["header"]) + 2)
        if self.options.get("freeze_header", True):
            self.ws.freeze_panes = "A2"
        fill = PatternFill("solid", fgColor=self.options.get("header_color", "1F4E78"))
        header = []
        for col in self.columns:
            cell = WriteOnlyCell(self.ws, value=col["header"])
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            header.append(cell)
        self.ws.append(header)
        self.sheet_rows = 0

    def write(self, row: list[Any]) -> None:
        if self.sheet_rows >= self.max_rows:
            self._new_sheet()
        cells = []
        for value, fmt in zip(row, self.formats, strict=False):
            if isinstance(value, Decimal):
                value = float(value)
            if fmt and isinstance(value, (int, float, datetime)):
                cell = WriteOnlyCell(self.ws, value=value)
                cell.number_format = fmt
                cells.append(cell)
            elif isinstance(value, str) and value.startswith("="):
                # Texto del PDF nunca se escribe como fórmula (inyección de fórmulas / CSV injection).
                cell = WriteOnlyCell(self.ws, value=value)
                cell.data_type = "s"
                cells.append(cell)
            else:
                cells.append(value)
        self.ws.append(cells)
        self.sheet_rows += 1
        self.total_rows += 1

    def _close_sheet(self) -> None:
        last = self.sheet_rows + 1
        n_cols = len(self.columns)
        if self.options.get("autofilter", True) and n_cols:
            self.ws.auto_filter.ref = f"A1:{get_column_letter(n_cols)}{last}"
        totals = [c for c in self.columns if c.get("total")]
        if self.options.get("totals_row", True) and totals and self.sheet_rows:
            self.ws.append([])
            row: list[Any] = []
            for i, col in enumerate(self.columns, start=1):
                letter = get_column_letter(i)
                if i == 1 and not col.get("total"):
                    cell = WriteOnlyCell(self.ws, value="TOTAL")
                elif col.get("total"):
                    cell = WriteOnlyCell(self.ws, value=f"=SUBTOTAL(9,{letter}2:{letter}{last})")
                    cell.number_format = self.formats[i - 1] or "#,##0.00"
                    cell.border = Border(top=Side(style="thin"), bottom=Side(style="double"))
                else:
                    row.append(None)
                    continue
                cell.font = Font(bold=True)
                row.append(cell)
            self.ws.append(row)

    def close(self) -> None:
        self._close_sheet()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.wb.save(self.path)
