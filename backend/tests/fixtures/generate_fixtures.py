"""Genera reportes SINTÉTICOS (PDF y TXT) para pruebas. Nunca usar datos reales de clientes.

Formato "Reporte de ventas por vendedor" (inventado; sirve para probar que el
mapeo es genérico): encabezado de página, línea de vendedor (contexto), líneas de detalle,
notas que continúan la línea anterior y una línea de total por vendedor (control de cuadre).

    python tests/fixtures/generate_fixtures.py                 # regenera sample_report.pdf/.txt
    python tests/fixtures/generate_fixtures.py --pages 2000 --out big.pdf   # archivo pesado
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
LINES_PER_PAGE = 60
CLIENTES = [
    "COMERCIAL ANDES S.A.",
    "DISTRIBUIDORA EL SOL",
    "FERRETERIA LA LLAVE",
    "PANADERIA SAN JOSE",
    "TEXTILES DEL NORTE",
    "IMPORTADORA PACIFICO",
    "FARMACIA CENTRAL",
    "LIBRERIA ESTUDIANTIL",
    "MUEBLES ARTESANALES",
    "CAFETERIA AROMA ÑAÑO",
]
VENDEDORES = ["ANA PEREZ", "LUIS TORRES", "MARIA GOMEZ", "JOSE ALVAREZ", "CARLA RUIZ", "PEDRO NUÑEZ"]
ZONAS = ["NORTE", "SUR", "CENTRO", "COSTA"]


@dataclass
class Expected:
    vendors: int = 0
    details: int = 0
    notes: int = 0
    total_qty: int = 0
    total_amount: Decimal = Decimal("0")
    corrupted: list[str] = field(default_factory=list)


def money(value: Decimal) -> str:
    return f"{value:,.2f}"


def build_report(pages: int = 3, seed: int = 7, corrupt_vendor: int | None = None) -> tuple[list[list[str]], Expected]:
    """Devuelve (páginas -> líneas, valores esperados). `corrupt_vendor` altera el total impreso
    de ese vendedor (índice base 0) para probar el control de cuadre."""
    rnd = random.Random(seed)
    body: list[str] = []
    exp = Expected()
    target_lines = pages * (LINES_PER_PAGE - 5)
    vendor_idx = 0
    invoice = 122  # la primera factura es F-000123 (la usan las pruebas E2E del frontend)
    while len(body) < target_lines:
        code = f"V{vendor_idx + 1:03d}"
        name = VENDEDORES[vendor_idx % len(VENDEDORES)]
        body.append(f"Vendedor: {code} {name:<25} Zona: {ZONAS[vendor_idx % len(ZONAS)]}")
        exp.vendors += 1
        qty_sum, amount_sum = 0, Decimal("0")
        for _ in range(rnd.randint(3, 12)):
            invoice += 1
            day, month = rnd.randint(1, 28), rnd.randint(1, 12)
            qty = rnd.randint(1, 500)
            amount = Decimal(rnd.randint(100, 9_999_999)) / 100
            cliente = rnd.choice(CLIENTES)
            if invoice == 123:  # línea conocida: 01/02/2026 en columnas 0-9, F-000123, COMERCIAL ANDES
                day, month, cliente = 1, 2, CLIENTES[0]
            body.append(f"{day:02d}/{month:02d}/2026  F-{invoice:06d}  {cliente:<28}{qty:>6}{money(amount):>12}")
            exp.details += 1
            qty_sum += qty
            amount_sum += amount
            if rnd.random() < 0.15:
                body.append(f"{'':12}Nota: entrega parcial {rnd.randint(1, 9)}")
                exp.notes += 1
        printed = amount_sum + (Decimal("1.00") if corrupt_vendor == vendor_idx else 0)
        if corrupt_vendor == vendor_idx:
            exp.corrupted.append(code)
        body.append(f"{'':30}Total vendedor:{qty_sum:>12}{money(printed):>12}")
        body.append("")
        exp.total_qty += qty_sum
        exp.total_amount += amount_sum
        vendor_idx += 1

    per_page = LINES_PER_PAGE - 5
    out: list[list[str]] = []
    chunks = [body[i : i + per_page] for i in range(0, len(body), per_page)]
    for n, chunk in enumerate(chunks, start=1):
        header = [
            f"{'EMPRESA DEMO S.A.':<60}Pag. {n}",
            "REPORTE DE VENTAS POR VENDEDOR",
            f"{'Fecha':<12}{'Factura':<10}{'Cliente':<28}{'Cant.':>6}{'Total':>12}",
            "-" * 68,
        ]
        out.append(header + chunk)
    return out, exp


# --- Escritores ------------------------------------------------------------------------------
def _pdf_escape(text: str) -> bytes:
    raw = text.encode("cp1252", errors="replace")
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def write_pdf(
    pages: list[list[str]], path: Path, font_size: float = 7, leading: float = 11, x: float = 20, top: float = 770
) -> Path:
    """PDF mínimo válido con fuente Courier (monoespaciada, 0,6 em por carácter)."""
    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    catalog = add(b"")  # se rellena al final
    pages_id = add(b"")
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
    kids = []
    for lines in pages:
        ops = [b"BT", f"/F1 {font_size} Tf".encode(), f"{leading} TL".encode(), f"{x} {top} Td".encode()]
        for line in lines:
            ops.append(b"(" + _pdf_escape(line) + b") Tj T*")
        ops.append(b"ET")
        stream = b"\n".join(ops)
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        kids.append(
            add(
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font} 0 R >> >> /Contents {content} 0 R >>".encode()
            )
        )
    objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    objects[pages_id - 1] = (
        f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode()
    )

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(out))
    return path


def write_txt(pages: list[list[str]], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\f".join("\n".join(lines) for lines in pages), encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=Path, default=HERE / "sample_report.pdf")
    args = parser.parse_args()
    pages, exp = build_report(args.pages, args.seed)
    write_pdf(pages, args.out)
    write_txt(pages, args.out.with_suffix(".txt"))
    print(f"{args.out} · páginas={len(pages)} vendedores={exp.vendors} detalles={exp.details} total={exp.total_amount}")


if __name__ == "__main__":
    main()
