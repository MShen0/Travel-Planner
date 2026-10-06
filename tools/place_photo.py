#!/usr/bin/env python3
"""Find a freely licensed photo of a place on Wikipedia / Wikimedia Commons, with its credit.

    python tools/place_photo.py "Sensō-ji" --title "en:Sensō-ji" --out .cache/photos
    python tools/place_photo.py --batch places.json --out .cache/photos

A batch file is a JSON list of {name, nameLocal?, city?, wiki?}; `wiki` pins the article as "lang:Title"
(e.g. "ja:浅草寺"; several separated by "|" are tried in order). Without it the script searches ja / zh / en Wikipedia for the local name and checks that
the article title resembles it. Only Commons files under CC0, CC BY, CC BY-SA or public domain are used:
an article's lead image hosted locally on a single Wikipedia (logos, fair use) is skipped.

Prints JSON: [{name, file, credit: {author, license, licenseUrl, source, text}}] — show `credit.text`
wherever the photo appears.
"""
from __future__ import annotations

import argparse
import html as htmllib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geocode import names_match  # noqa: E402
from provenance import embed_origin  # noqa: E402

UA = "travel-planner/0.1 (personal trip planner; https://github.com/mshen0/travel-planner)"
FREE_LICENSE = re.compile(r"^(cc0|cc[- ]by(?:[- ]sa)?(?:[- ][\d.]+)?|public domain|pd\b|pdm)", re.I)


def get_json(url: str, retries: int = 3) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1:
                raise
            time.sleep(2 ** (attempt + 1))  # Wikimedia asks clients to back off
    raise RuntimeError("unreachable")


def commons_file(image_url: str | None) -> str | None:
    """'File:Name.jpg' for a Commons upload URL; None for files hosted on a single Wikipedia."""
    if not image_url or "/wikipedia/commons/" not in image_url:
        return None
    name = urllib.parse.unquote(image_url.split("?")[0].rstrip("/").split("/")[-1])
    if re.match(r"^\d+px-", name):  # thumbnail URL: .../thumb/a/ab/Name.jpg/330px-Name.jpg
        name = urllib.parse.unquote(image_url.split("?")[0].split("/")[-2])
    return "File:" + name


def plain(html_text: str | None) -> str:
    text = re.sub(r"<[^>]+>", "", html_text or "")
    return re.sub(r"\s+", " ", htmllib.unescape(text)).strip()


def is_free(license_name: str | None) -> bool:
    return bool(license_name and FREE_LICENSE.search(license_name.strip()))


def credit_text(author: str, license_name: str) -> str:
    who = author if author and len(author) <= 60 else "Wikimedia Commons"
    return f"照片：{who} · {license_name} · Wikimedia Commons"


def article_image(lang: str, title: str) -> tuple[str | None, str]:
    data = get_json(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title, safe='')}")
    img = (data.get("originalimage") or data.get("thumbnail") or {}).get("source")
    return img, data.get("title") or title


def search_title(lang: str, query: str) -> str | None:
    q = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": query, "srlimit": 1, "format": "json"})
    hits = get_json(f"https://{lang}.wikipedia.org/w/api.php?{q}").get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def file_info(file_title: str, width: int) -> dict | None:
    q = urllib.parse.urlencode({"action": "query", "titles": file_title, "prop": "imageinfo", "format": "json",
                                "iiprop": "url|extmetadata", "iiurlwidth": width})
    pages = get_json(f"https://commons.wikimedia.org/w/api.php?{q}").get("query", {}).get("pages", {})
    for page in pages.values():
        info = (page.get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata") or {}
        license_name = plain((meta.get("LicenseShortName") or {}).get("value"))
        if not is_free(license_name):
            return None
        author = plain((meta.get("Artist") or {}).get("value")) or plain((meta.get("Credit") or {}).get("value"))
        return {"url": info.get("thumburl") or info.get("url"), "author": author, "license": license_name,
                "licenseUrl": (meta.get("LicenseUrl") or {}).get("value", ""), "source": info.get("descriptionurl", "")}
    return None


def find_photo(place: dict, langs=("ja", "zh", "en"), width: int = 1080) -> dict | None:
    candidates: list[tuple[str, str]] = []
    if place.get("wiki"):
        for pinned in place["wiki"].split("|"):  # "en:Tsukiji Outer Market|en:Tsukiji fish market"
            lang, _, title = pinned.strip().partition(":")
            candidates.append((lang, title))
    else:
        for lang in langs:
            query = place.get("nameLocal") or place.get("name")
            try:
                title = search_title(lang, query)
            except Exception:
                title = None
            if title and any(names_match(n, title) for n in (place.get("nameLocal"), place.get("name")) if n):
                candidates.append((lang, title))
    for lang, title in candidates:
        try:
            img, resolved = article_image(lang, title)
            file_title = commons_file(img)
            info = file_info(file_title, width) if file_title else None
        except Exception as e:
            print(f"[place_photo] {lang}:{title}: {e}", file=sys.stderr)
            continue
        if info:
            info["article"] = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(resolved.replace(' ', '_'))}"
            return info
    return None


def download(url: str, path: str, retries: int = 3) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                f.write(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1:
                raise
            time.sleep(2 ** (attempt + 1))


def slug(text: str) -> str:
    s = re.sub(r"[^\w\-]+", "-", text.lower(), flags=re.UNICODE).strip("-")
    return s[:60] or "photo"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Freely licensed place photos from Wikimedia Commons.")
    ap.add_argument("name", nargs="?")
    ap.add_argument("--title", help='pin the article, e.g. "en:Sensō-ji"')
    ap.add_argument("--batch", help="JSON list of places")
    ap.add_argument("--out", default=".cache/photos")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--pause", type=float, default=1.0, help="seconds between places (raise it if Wikimedia answers 429)")
    args = ap.parse_args(argv)
    places = json.load(open(args.batch, encoding="utf-8")) if args.batch else [{"name": args.name, "wiki": args.title}]
    if not places or not places[0].get("name"):
        ap.error("give a place name or --batch FILE")
    os.makedirs(args.out, exist_ok=True)
    results = []
    for i, p in enumerate(places):
        if i:
            time.sleep(args.pause)  # stay well inside Wikimedia's request limits
        info = find_photo(p, width=args.width)
        if not info:
            results.append({"name": p["name"], "file": None, "credit": None})
            continue
        ext = os.path.splitext(urllib.parse.urlparse(info["url"]).path)[1].lower() or ".jpg"
        path = os.path.join(args.out, slug(p.get("id") or p["name"]) + (ext if ext in (".jpg", ".jpeg", ".png", ".webp") else ".jpg"))
        try:
            download(info["url"], path)
        except Exception as e:
            print(f"[place_photo] download {p['name']}: {e}", file=sys.stderr)
            results.append({"name": p["name"], "id": p.get("id"), "file": None, "credit": None})
            continue
        credit = {k: info[k] for k in ("author", "license", "licenseUrl", "source")}
        credit["text"] = credit_text(info["author"], info["license"])
        embed_origin(path, f"Sourced photo for {p['name']}: Wikimedia Commons {credit['source']} · {credit['author']} · "
                           f"{credit['license']} {credit['licenseUrl'] or ''} · fetched by tools/place_photo.py".strip())
        results.append({"name": p["name"], "id": p.get("id"), "file": path, "credit": credit, "article": info["article"]})
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
