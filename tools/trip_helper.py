#!/usr/bin/env python3
"""Group saved places into days by geography and order each day's route.

    python tools/trip_helper.py places.json --days 3 [--base 35.6896,139.7006]

places.json is a list of {id, name, lat, lng, ...}. Prints JSON:
    {"groups": [{"day": 1, "km": 4.2, "places": [{"id", "name", "lat", "lng", "km_from_prev"}]}],
     "no_coord": [{"id", "name"}]}

Same method as the app (app/bacao.html → clusterIntoDays): size-capped k-means
seeded with far-apart points, then nearest-neighbour + 2-opt inside each day,
so the agent and the app propose the same grouping.
"""
from __future__ import annotations

import argparse
import json
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from geocode import haversine_km  # noqa: E402


def has_coord(p: dict | None) -> bool:
    if not p:
        return False
    lat, lng = p.get("lat"), p.get("lng")
    return (isinstance(lat, (int, float)) and isinstance(lng, (int, float)) and abs(lat) <= 90 and abs(lng) <= 180
            and not (lat == 0 and lng == 0))


def km(a: dict, b: dict) -> float:
    return haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])


def route_km(points: list[dict], start: dict | None = None) -> float:
    total, prev = 0.0, start if has_coord(start) else None
    for p in points:
        if prev is not None:
            total += km(prev, p)
        prev = p
    return total


def order_route(points: list[dict], start: dict | None = None) -> list[dict]:
    """Nearest-neighbour tour from `start`, then 2-opt until no reversal shortens it."""
    rest = [p for p in points if has_coord(p)]
    if not rest:
        return []
    tour: list[dict] = []
    cur = start if has_coord(start) else rest.pop(0)
    if not has_coord(start):
        tour.append(cur)
    while rest:
        nxt = min(rest, key=lambda p: km(cur, p))
        rest.remove(nxt)
        tour.append(nxt)
        cur = nxt
    head = start if has_coord(start) else None
    improved, guard = True, 0
    while improved and guard < 50:
        improved, guard = False, guard + 1
        for i in range(len(tour) - 1):
            for j in range(i + 1, len(tour)):
                cand = tour[:i] + tour[i:j + 1][::-1] + tour[j + 1:]
                if route_km(cand, head) + 1e-9 < route_km(tour, head):
                    tour, improved = cand, True
    return tour


def centroid(points: list[dict]) -> dict:
    return {"lat": sum(p["lat"] for p in points) / len(points), "lng": sum(p["lng"] for p in points) / len(points)}


def cluster_into_days(places: list[dict], days: int, base: dict | None = None) -> tuple[list[list[dict]], list[dict]]:
    pts = [p for p in places if has_coord(p)]
    no_coord = [p for p in places if not has_coord(p)]
    groups: list[list[dict]] = [[] for _ in range(max(1, days))]
    if not pts:
        return groups, no_coord
    k = max(1, min(days, len(pts)))
    first = max(pts, key=lambda p: km(p, base)) if has_coord(base) else pts[0]
    centers = [{"lat": first["lat"], "lng": first["lng"]}]
    while len(centers) < k:
        far = max(pts, key=lambda p: min(km(p, c) for c in centers))
        centers.append({"lat": far["lat"], "lng": far["lng"]})
    cap = math.ceil(len(pts) / k) + (1 if len(pts) > k else 0)
    assign = [-1] * len(pts)
    for _ in range(15):
        pairs = sorted((km(p, c), i, j) for i, p in enumerate(pts) for j, c in enumerate(centers))
        count, nxt = [0] * k, [-1] * len(pts)
        for _, i, j in pairs:
            if nxt[i] == -1 and count[j] < cap:
                nxt[i] = j
                count[j] += 1
        changed = nxt != assign
        assign = nxt
        centers = [centroid([p for p, a in zip(pts, assign) if a == j]) if j in assign else c
                   for j, c in enumerate(centers)]
        if not changed:
            break
    for j in range(k):
        groups[j] = order_route([p for p, a in zip(pts, assign) if a == j], base)
    if has_coord(base):
        groups.sort(key=lambda g: km(base, centroid(g)) if g else 1e9)
    return groups, no_coord


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Group places into days and order each day's route.")
    ap.add_argument("places", help="JSON list of places with lat/lng")
    ap.add_argument("--days", type=int, required=True)
    ap.add_argument("--base", help="lat,lng of the hotel / daily start")
    args = ap.parse_args(argv)
    with open(args.places, encoding="utf-8") as f:
        places = json.load(f)
    base = None
    if args.base:
        lat, lng = (float(x) for x in args.base.split(","))
        base = {"lat": lat, "lng": lng}
    groups, no_coord = cluster_into_days(places, args.days, base)
    out = {"groups": [], "no_coord": [{"id": p.get("id"), "name": p.get("name")} for p in no_coord]}
    for d, g in enumerate(groups, 1):
        prev, rows = base, []
        for p in g:
            rows.append({"id": p.get("id"), "name": p.get("name"), "lat": p["lat"], "lng": p["lng"],
                         "km_from_prev": round(km(prev, p), 2) if has_coord(prev) else None})
            prev = p
        out["groups"].append({"day": d, "km": round(route_km(g, base), 2), "places": rows})
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
