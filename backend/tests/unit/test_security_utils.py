"""RNF-03 / RF-03 · Sanitización de nombres, tipos permitidos, firmas y validación de ids."""

import uuid

import pytest

from app.services.errors import NotFound, Unsupported
from app.services.security import check_signature, file_kind, safe_filename, valid_uuid


@pytest.mark.req("RNF-03")
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("reporte.pdf", "reporte.pdf"),
        ("../../etc/passwd.pdf", "passwd.pdf"),
        ("C:\\Windows\\system32\\x.pdf", "x.pdf"),
        ("a<b>c|d?.pdf", "a_b_c_d_.pdf"),
        ("reporte de ventas ñ.pdf", "reporte de ventas ñ.pdf"),
        ("...", "archivo"),
        ("", "archivo"),
    ],
)
def test_safe_filename(raw, expected):
    assert safe_filename(raw) == expected


@pytest.mark.req("RNF-03")
def test_safe_filename_truncates():
    assert len(safe_filename("a" * 500 + ".pdf")) == 200


@pytest.mark.req("RF-03")
@pytest.mark.parametrize(("name", "kind"), [("a.PDF", "pdf"), ("a.Pdf", "pdf"), ("a.txt", "text"), ("a.prn", "text")])
def test_file_kind_supported(name, kind):
    assert file_kind(name) == kind


@pytest.mark.req("RF-03")
@pytest.mark.parametrize("name", ["a.exe", "a.xlsx", "sin_extension", "a.pdf.exe"])
def test_file_kind_rejected(name):
    with pytest.raises(Unsupported):
        file_kind(name)


@pytest.mark.req("RF-03")
def test_check_signature(tmp_path):
    good = tmp_path / "ok.pdf"
    good.write_bytes(b"%PDF-1.4\n...")
    check_signature(good, "pdf")
    fake = tmp_path / "fake.pdf"
    fake.write_bytes(b"MZ\x90\x00 ejecutable")
    with pytest.raises(Unsupported):
        check_signature(fake, "pdf")
    binary = tmp_path / "bin.txt"
    binary.write_bytes(b"abc\x00def")
    with pytest.raises(Unsupported):
        check_signature(binary, "text")


@pytest.mark.req("RNF-03")
@pytest.mark.parametrize("value", ["../x", "abc", "", str(uuid.uuid4()).upper(), "1" * 36])
def test_valid_uuid_rejects(value):
    with pytest.raises(NotFound):
        valid_uuid(value)


@pytest.mark.req("RNF-03")
def test_valid_uuid_accepts():
    value = str(uuid.uuid4())
    assert valid_uuid(value) == value
