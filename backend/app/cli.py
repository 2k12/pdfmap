"""CLI sin servidor: aplica una plantilla a un PDF/TXT y genera el Excel.

python -m app.cli reporte.pdf -t app/templates_builtin/ventas_ejemplo.json -o salida.xlsx
python -m app.cli reporte.pdf --dump-page 1          # ver la cuadrícula de texto de una página
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .core.export import CsvExporter, ExcelExporter
from .core.extraction import iter_lines, open_extractor
from .core.mapping import MappingEngine, column_types
from .schemas import Template
from .services.security import file_kind


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pdfmap", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("-t", "--template", type=Path, help="plantilla JSON")
    parser.add_argument("-o", "--output", type=Path, help="salida .xlsx o .csv")
    parser.add_argument("--dump-page", type=int, help="imprime las líneas de una página y termina")
    parser.add_argument("--char-width", type=float)
    args = parser.parse_args(argv)

    kind = file_kind(args.input.name)
    extractor = open_extractor(args.input, kind, {"char_width": args.char_width} if args.char_width else None)
    try:
        if args.dump_page:
            for i, line in enumerate(extractor.page_lines(args.dump_page), start=1):
                print(f"{i:4d}| {line}")
            return 0
        if not args.template or not args.output:
            parser.error("--template y --output son obligatorios para exportar")
        template = Template.model_validate(json.loads(args.template.read_text(encoding="utf-8"))).engine_dict()
        engine = MappingEngine(template)
        if args.output.suffix.lower() == ".csv":
            writer: CsvExporter | ExcelExporter = CsvExporter(
                args.output, engine.columns, template["options"]["csv_delimiter"]
            )
        else:
            writer = ExcelExporter(args.output, engine.columns, template["options"], column_types(template))
        started = time.perf_counter()
        for row in engine.process(iter_lines(extractor)):
            writer.write(row)
        writer.close()
        stats = engine.finish_stats()
        print(
            f"Páginas: {extractor.page_count()} | Filas: {stats['rows']} | Sin regla: {stats['unmatched']} "
            f"| Errores: {stats['error_count']} | Controles OK: {stats['checks_ok']} "
            f"| Fallidos: {stats['checks_failed_count']} | {time.perf_counter() - started:.1f}s"
        )
        for issue in stats["checks_failed"][:20] + stats["errors"][:20]:
            print(f"  pág {issue['page']} línea {issue['line']} [{issue['rule']}] {issue['message']}")
        print(f"Generado: {args.output}")
        return 1 if stats["checks_failed_count"] else 0
    finally:
        extractor.close()


if __name__ == "__main__":
    sys.exit(main())
