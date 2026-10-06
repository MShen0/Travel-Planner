"""tools/trip_helper.py groups places the same way the app does."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import trip_helper as th  # noqa: E402

TOKYO = [
    ("浅草寺", 35.7148, 139.7967), ("晴空塔", 35.7101, 139.8107), ("上野公园", 35.7156, 139.7745),
    ("涩谷 Sky", 35.6585, 139.7023), ("明治神宫", 35.6764, 139.6993), ("竹下通", 35.6716, 139.7031),
    ("台场 teamLab", 35.6267, 139.7839), ("丰洲市场", 35.6455, 139.7853), ("月岛文字烧", 35.6630, 139.7810),
]
PLACES = [{"id": f"p_{i}", "name": n, "lat": lat, "lng": lng} for i, (n, lat, lng) in enumerate(TOKYO)]


def test_three_areas_become_three_days():
    groups, no_coord = th.cluster_into_days(PLACES + [{"id": "p_x", "name": "无坐标"}], 3)
    assert [p["id"] for p in no_coord] == ["p_x"]
    names = [sorted(p["name"] for p in g) for g in groups]
    assert sorted(["上野公园", "晴空塔", "浅草寺"]) in names
    assert sorted(["明治神宫", "涩谷 Sky", "竹下通"]) in names
    assert all(len(g) <= 4 for g in groups)


def test_base_puts_nearest_area_first():
    shinjuku = {"lat": 35.6896, "lng": 139.7006}
    groups, _ = th.cluster_into_days(PLACES, 3, shinjuku)
    assert "明治神宫" in [p["name"] for p in groups[0]]


def test_order_route_is_not_longer_than_input():
    shuffled = [PLACES[6], PLACES[0], PLACES[3], PLACES[1], PLACES[4]]
    assert th.route_km(th.order_route(shuffled)) <= th.route_km(shuffled) + 1e-9


def test_more_days_than_places():
    groups, _ = th.cluster_into_days(PLACES[:2], 4)
    assert len(groups) == 4 and sum(len(g) for g in groups) == 2
