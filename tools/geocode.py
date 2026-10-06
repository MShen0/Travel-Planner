#!/usr/bin/env python3
"""Free geocoding for saved places (OpenStreetMap Nominatim, Photon as fallback).

    python tools/geocode.py "一蘭 渋谷店" --city 東京 --country jp
    python tools/geocode.py --batch places.json --out places.geo.json

A batch file is a JSON list of {name, nameLocal?, city?, country?, lat?, lng?};
lat/lng there are treated as a rough hint (e.g. Claude's estimate) and are
replaced only by a match within --max-km of it. A loose ("area") match never
replaces an estimate already marked coordConfidence "exact", and places with
`chain: true` (a chain with no branch named) are left alone so the planner can
pick a branch on the day's route. Each result gains
`geo: {source, display_name, confidence: "exact"|"area"}`.

Nominatim's usage policy allows one request per second with an identifying
User-Agent; results are cached in .cache/geocode.json so repeats are free.
OSM has thin coverage of small shops in mainland China: expect "area" or no
match there and keep the estimate.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "travel-planner/0.1 (personal trip planner; https://github.com/mshen0/travel-planner)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(ROOT, ".cache", "geocode.json")
EXACT_CLASSES = {"amenity", "shop", "tourism", "leisure", "historic", "railway", "building", "natural",
                 "aeroway", "man_made", "office", "craft"}
COUNTRY_CODES = {
    "日本": "jp", "japan": "jp", "韩国": "kr", "korea": "kr", "south korea": "kr", "中国": "cn", "china": "cn",
    "台湾": "tw", "taiwan": "tw", "香港": "hk", "hong kong": "hk", "澳门": "mo", "泰国": "th", "thailand": "th",
    "马来西亚": "my", "malaysia": "my", "新加坡": "sg", "singapore": "sg", "越南": "vn", "vietnam": "vn",
    "印尼": "id", "印度尼西亚": "id", "indonesia": "id", "菲律宾": "ph", "philippines": "ph",
    "澳大利亚": "au", "australia": "au", "英国": "gb", "uk": "gb", "法国": "fr", "france": "fr",
    "意大利": "it", "italy": "it", "西班牙": "es", "spain": "es", "美国": "us", "usa": "us",
}

_last_call = [0.0]


def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def country_code(country: str | None) -> str | None:
    if not country:
        return None
    c = country.strip().lower()
    if c in COUNTRY_CODES:
        return COUNTRY_CODES[c]
    if len(c) == 2 and c.isascii() and c.isalpha():
        return c
    return None


def queries_for(place: dict) -> list[str]:
    name, local, city = place.get("name"), place.get("nameLocal"), place.get("city")
    out = []
    for q in (f"{local} {city}" if local and city else None, f"{name} {city}" if name and city else None, local,
              name):
        if q and q.strip() and q not in out:
            out.append(q.strip())
    return out


def classify(result: dict) -> str:
    cls = result.get("category") or result.get("class") or result.get("osm_key")
    return "exact" if cls in EXACT_CLASSES else "area"


def _norm(s: str | None) -> str:
    return re.sub(r"[\s\W_]+", "", (s or "").lower())


def names_match(query: str, found: str | None) -> bool:
    """Loose check that a hit names the place asked for, not just something nearby."""
    q, f = _norm(query), _norm(found)
    if not q or not f:
        return False
    if q in f or f in q:
        return True
    if re.search(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]", q):  # CJK: compare characters
        overlap = sum(1 for ch in set(q) if ch in f)
        return overlap / max(1, len(set(q))) >= 0.5
    qt, ft = set(re.findall(r"\w+", query.lower())), set(re.findall(r"\w+", (found or "").lower()))
    return len(qt & ft) / max(1, len(qt)) >= 0.5


def pick_best(results: list[dict], hint: tuple[float, float] | None, max_km: float) -> dict | None:
    best, best_score = None, None
    for r in results:
        try:
            lat, lng = float(r["lat"]), float(r["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        if hint and haversine_km(hint[0], hint[1], lat, lng) > max_km:
            continue
        score = (0 if r["confidence"] == "exact" else 1, r.get("rank", 0))
        if best_score is None or score < best_score:
            best, best_score = r, score
    return best


class Geocoder:
    def __init__(self, cache_path: str = CACHE_PATH, offline: bool = False):
        self.cache_path = cache_path
        self.offline = offline
        try:
            with open(cache_path, encoding="utf-8") as f:
                self.cache = json.load(f)
        except (OSError, json.JSONDecodeError):
            self.cache = {}

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(self.cache, f, ensure_ascii=False, indent=1)

    def _get(self, url: str) -> list | dict | None:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh,ja,en"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception:  # network trouble is a miss, not a crash
            return None

    def nominatim(self, q: str, cc: str | None) -> list[dict]:
        key = f"n|{cc or ''}|{q}"
        if key in self.cache:
            return self.cache[key]
        if self.offline:
            return []
        wait = 1.05 - (time.time() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        params = {"q": q, "format": "jsonv2", "limit": "5", "addressdetails": "0"}
        if cc:
            params["countrycodes"] = cc
        data = self._get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params))
        _last_call[0] = time.time()
        out = []
        for i, r in enumerate(data or []):
            out.append({"lat": float(r["lat"]), "lng": float(r["lon"]), "display_name": r.get("display_name"),
                        "name": r.get("name") or (r.get("display_name") or "").split(",")[0],
                        "confidence": classify(r), "source": "nominatim", "rank": i})
        self.cache[key] = out
        return out

    def photon(self, q: str, hint: tuple[float, float] | None) -> list[dict]:
        key = f"p|{hint and round(hint[0], 1)},{hint and round(hint[1], 1)}|{q}"
        if key in self.cache:
            return self.cache[key]
        if self.offline:
            return []
        params = {"q": q, "limit": "5"}
        if hint:
            params.update({"lat": str(hint[0]), "lon": str(hint[1])})
        data = self._get("https://photon.komoot.io/api/?" + urllib.parse.urlencode(params)) or {}
        out = []
        for i, f in enumerate(data.get("features") or []):
            lng, lat = f["geometry"]["coordinates"]
            props = f.get("properties") or {}
            label = ", ".join(str(props[k]) for k in ("name", "district", "city", "country") if props.get(k))
            out.append({"lat": lat, "lng": lng, "display_name": label, "name": props.get("name"),
                        "confidence": classify(props), "source": "photon", "rank": i})
        self.cache[key] = out
        return out

    def locate(self, place: dict, max_km: float = 30.0) -> dict | None:
        cc = country_code(place.get("country"))
        hint = None
        if isinstance(place.get("lat"), (int, float)) and isinstance(place.get("lng"), (int, float)):
            hint = (float(place["lat"]), float(place["lng"]))
        elif place.get("city"):
            city = self.nominatim(place["city"], cc)
            if city:
                hint = (city[0]["lat"], city[0]["lng"])
                max_km = max(max_km, 60.0)
        for q in queries_for(place):
            best = pick_best(self.nominatim(q, cc), hint, max_km) or pick_best(self.photon(q, hint), hint, max_km)
            if best:
                wanted = [n for n in (place.get("nameLocal"), place.get("name")) if n]
                exact = best["confidence"] == "exact" and any(names_match(n, best.get("name")) for n in wanted)
                return {"lat": round(best["lat"], 6), "lng": round(best["lng"], 6), "query": q,
                        "display_name": best["display_name"], "source": best["source"],
                        "confidence": "exact" if exact else "area"}
        return None


def geocode_batch(places: list[dict], geocoder: Geocoder, max_km: float = 30.0) -> list[dict]:
    out = []
    for p in places:
        p = dict(p)
        if p.get("chain"):
            out.append(p)
            continue
        hit = geocoder.locate(p, max_km)
        had_exact = p.get("coordConfidence") == "exact" and isinstance(p.get("lat"), (int, float))
        if hit and hit["confidence"] == "area" and had_exact:
            hit = None  # a fuzzy OSM hit is worse than an estimate that was already pinned
        if hit:
            p["lat"], p["lng"] = hit["lat"], hit["lng"]
            p["coordConfidence"] = hit["confidence"]
            p["geo"] = {k: hit[k] for k in ("source", "display_name", "confidence", "query")}
        out.append(p)
    geocoder.save()
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Free geocoding with OpenStreetMap.")
    ap.add_argument("query", nargs="?", help="place name")
    ap.add_argument("--city")
    ap.add_argument("--country", help="name or ISO code, e.g. 日本 / jp")
    ap.add_argument("--near", help="lat,lng hint")
    ap.add_argument("--batch", help="JSON list of places")
    ap.add_argument("--out", help="where to write the batch result (default: stdout)")
    ap.add_argument("--max-km", type=float, default=30.0, help="reject matches farther than this from the hint")
    args = ap.parse_args(argv)
    g = Geocoder()
    if args.batch:
        with open(args.batch, encoding="utf-8") as f:
            places = json.load(f)
        result = geocode_batch(places, g, args.max_km)
        found = sum(1 for p in result if p.get("geo"))
        text = json.dumps(result, ensure_ascii=False, indent=2)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(text + "\n")
            print(f"geocoded {found}/{len(result)} -> {args.out}", file=sys.stderr)
        else:
            print(text)
        return 0
    if not args.query:
        ap.error("give a place name or --batch FILE")
    place = {"name": args.query, "city": args.city, "country": args.country}
    if args.near:
        lat, lng = (float(x) for x in args.near.split(","))
        place.update({"lat": lat, "lng": lng})
    hit = g.locate(place, args.max_km)
    g.save()
    print(json.dumps(hit, ensure_ascii=False, indent=2))
    return 0 if hit else 1


if __name__ == "__main__":
    sys.exit(main())
