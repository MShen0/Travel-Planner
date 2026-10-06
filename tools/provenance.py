"""Stamp where an image came from into the file itself, so the origin travels with every copy.

Same format impeccable's embed-prompt.mjs reads: keyword "impeccable:prompt", a NUL byte, then the text,
stored as a JPEG comment (COM) segment or a PNG tEXt chunk; other formats get a `<file>.json` sidecar.

    python tools/provenance.py photo.jpg                       # print the stamped origin
    python tools/provenance.py photo.jpg --set "Wikimedia …"   # stamp (replaces an older stamp)
"""
from __future__ import annotations

import json
import os
import sys
import zlib

KEYWORD = b"impeccable:prompt"
PNG_SIG = b"\x89PNG\r\n\x1a\n"


def _jpeg_segments(data: bytes):
    """Yield (offset, marker, length) for header segments up to the start of scan."""
    off = 2
    while off + 4 <= len(data) and data[off] == 0xFF:
        marker = data[off + 1]
        if marker == 0xDA:
            return
        length = int.from_bytes(data[off + 2:off + 4], "big")
        yield off, marker, length
        off += 2 + length


def _is_ours(payload: bytes) -> bool:
    return payload.startswith(KEYWORD + b"\0")


def read_origin(path: str) -> str | None:
    data = open(path, "rb").read()
    if data[:2] == b"\xff\xd8":
        for off, marker, length in _jpeg_segments(data):
            payload = data[off + 4:off + 2 + length]
            if marker == 0xFE and _is_ours(payload):
                return payload[len(KEYWORD) + 1:].decode("utf-8", "replace")
    elif data[:8] == PNG_SIG:
        off = 8
        while off + 8 <= len(data):
            n = int.from_bytes(data[off:off + 4], "big")
            kind, body = data[off + 4:off + 8], data[off + 8:off + 8 + n]
            if kind == b"tEXt" and _is_ours(body):
                return body[len(KEYWORD) + 1:].decode("utf-8", "replace")
            off += 12 + n
    sidecar = path + ".json"
    if os.path.exists(sidecar):
        try:
            return json.load(open(sidecar, encoding="utf-8")).get("prompt")
        except ValueError:
            return None
    return None


def embed_origin(path: str, text: str) -> None:
    """Write `text` as the image's origin, replacing an earlier stamp of ours."""
    data = open(path, "rb").read()
    payload = KEYWORD + b"\0" + text.encode("utf-8")
    if data[:2] == b"\xff\xd8":
        payload = payload[:0xFFFD]
        kept = bytearray(data[:2])
        last = 2
        for off, marker, length in _jpeg_segments(data):
            if marker == 0xFE and _is_ours(data[off + 4:off + 2 + length]):
                kept += data[last:off]
                last = off + 2 + length
        kept += data[last:]
        seg = b"\xff\xfe" + (len(payload) + 2).to_bytes(2, "big") + payload
        new = bytes(kept[:2]) + seg + bytes(kept[2:])
    elif data[:8] == PNG_SIG:
        out, off, iend = bytearray(data[:8]), 8, None
        while off + 8 <= len(data):
            n = int.from_bytes(data[off:off + 4], "big")
            kind, body = data[off + 4:off + 8], data[off + 8:off + 8 + n]
            if kind == b"IEND":
                iend = len(out)
            if not (kind == b"tEXt" and _is_ours(body)):
                out += data[off:off + 12 + n]
            off += 12 + n
        chunk = b"tEXt" + payload
        text_chunk = len(payload).to_bytes(4, "big") + chunk + zlib.crc32(chunk).to_bytes(4, "big")
        iend = len(out) - 12 if iend is None else iend
        new = bytes(out[:iend]) + text_chunk + bytes(out[iend:])
    else:
        json.dump({"prompt": text}, open(path + ".json", "w", encoding="utf-8"), ensure_ascii=False)
        return
    with open(path, "wb") as f:
        f.write(new)


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = args[0]
    if "--set" in args:
        embed_origin(path, args[args.index("--set") + 1])
    print(read_origin(path) or "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
