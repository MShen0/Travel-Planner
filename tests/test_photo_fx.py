"""Offline tests for tools/place_photo.py and tools/fx_rates.py."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import fx_rates  # noqa: E402
import place_photo as pp  # noqa: E402


def test_commons_file_from_original_and_thumbnail_urls():
    assert pp.commons_file("https://upload.wikimedia.org/wikipedia/commons/4/43/Sensoji_2023.jpg?utm_source=x") == \
        "File:Sensoji_2023.jpg"
    thumb = "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Headquarters_of_Ichiran_Ramen.jpg/330px-Headquarters_of_Ichiran_Ramen.jpg"
    assert pp.commons_file(thumb) == "File:Headquarters_of_Ichiran_Ramen.jpg"
    assert pp.commons_file("https://upload.wikimedia.org/wikipedia/commons/6/60/Sotokanda%2C_Akihabara.png") == \
        "File:Sotokanda,_Akihabara.png"
    # Files hosted on one Wikipedia only (logos, fair use) are never used.
    assert pp.commons_file("https://upload.wikimedia.org/wikipedia/en/a/ab/Some_logo.png") is None
    assert pp.commons_file(None) is None


def test_only_free_licenses_pass():
    for ok in ("CC0", "CC BY 2.0", "CC BY-SA 4.0", "cc-by-sa-3.0", "Public domain", "PD"):
        assert pp.is_free(ok), ok
    for bad in ("Fair use", "All rights reserved", "", None, "GFDL"):
        assert not pp.is_free(bad), bad


def test_plain_strips_artist_html():
    html = '<a href="//commons.wikimedia.org/wiki/User:Kakidai" title="User:Kakidai">Kakidai</a> &amp; friends'
    assert pp.plain(html) == "Kakidai & friends"
    assert pp.credit_text("Kakidai", "CC BY-SA 3.0") == "照片：Kakidai · CC BY-SA 3.0 · Wikimedia Commons"
    assert "Wikimedia Commons" in pp.credit_text("x" * 80, "CC0")


def test_fx_parsers_keep_known_currencies_only():
    er = {"result": "success", "time_last_update_unix": 1791244951,
          "rates": {"MYR": 1, "JPY": 38.7, "KRW": 327.73, "XAU": 0.0001, "TWD": 7.1}}
    out = fx_rates.parse_er_api(er, "MYR")
    assert out["rates"] == {"JPY": 38.7, "KRW": 327.73, "TWD": 7.1}
    assert out["date"] == "2026-10-06"
    assert fx_rates.parse_er_api({"result": "error"}, "MYR") is None
    fr = {"base": "MYR", "date": "2026-10-06", "rates": {"JPY": 38.7, "EUR": 0.217}}
    assert fx_rates.parse_frankfurter(fr, "MYR")["rates"]["EUR"] == 0.217


def _png_bytes() -> bytes:
    import zlib

    def chunk(kind: bytes, body: bytes) -> bytes:
        return len(body).to_bytes(4, "big") + kind + body + zlib.crc32(kind + body).to_bytes(4, "big")
    ihdr = (1).to_bytes(4, "big") * 2 + bytes([8, 2, 0, 0, 0])
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b"")


def test_provenance_stamps_and_restamps(tmp_path):
    import provenance
    jpg = tmp_path / "a.jpg"
    app0 = b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    jpg.write_bytes(b"\xff\xd8" + app0 + b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x12\x34\xff\xd9")
    provenance.embed_origin(str(jpg), "照片：Wikimedia Commons · CC BY-SA 4.0")
    provenance.embed_origin(str(jpg), "second stamp")
    data = jpg.read_bytes()
    assert provenance.read_origin(str(jpg)) == "second stamp"
    assert data.count(b"impeccable:prompt\0") == 1, "a new stamp replaces the old one"
    assert app0 in data and data.endswith(b"\x12\x34\xff\xd9"), "image data untouched"
    png = tmp_path / "b.png"
    png.write_bytes(_png_bytes())
    provenance.embed_origin(str(png), "rendered map")
    provenance.embed_origin(str(png), "rendered map v2")
    assert provenance.read_origin(str(png)) == "rendered map v2"
    assert png.read_bytes().endswith(b"IEND\xaeB`\x82")
    webp = tmp_path / "c.webp"
    webp.write_bytes(b"RIFF\x00\x00\x00\x00WEBP")
    provenance.embed_origin(str(webp), "sidecar")
    assert provenance.read_origin(str(webp)) == "sidecar"
