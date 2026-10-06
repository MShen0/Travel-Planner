"""Offline tests for tools/geocode.py (no network)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import geocode as gc  # noqa: E402


def test_haversine_shibuya_to_harajuku():
    km = gc.haversine_km(35.6580, 139.7016, 35.6702, 139.7027)
    assert 1.2 < km < 1.5


def test_country_code():
    assert gc.country_code("日本") == "jp"
    assert gc.country_code("JP") == "jp"
    assert gc.country_code("Malaysia") == "my"
    assert gc.country_code("火星") is None
    assert gc.country_code(None) is None


def test_queries_prefer_local_name_with_city():
    qs = gc.queries_for({"name": "一兰拉面 涩谷店", "nameLocal": "一蘭 渋谷店", "city": "東京"})
    assert qs == ["一蘭 渋谷店 東京", "一兰拉面 涩谷店 東京", "一蘭 渋谷店", "一兰拉面 涩谷店"]


def test_names_match():
    assert gc.names_match("一蘭 渋谷店", "一蘭 澀谷店")
    assert gc.names_match("Tsutaya Daikanyama", "Daikanyama T-Site Tsutaya")
    assert not gc.names_match("代官山 蔦屋書店", "Daikan-yama")
    assert not gc.names_match("", "anything")


def test_pick_best_rejects_far_hits_and_prefers_exact():
    hint = (35.66, 139.70)
    results = [
        {"lat": 34.67, "lng": 135.50, "confidence": "exact", "rank": 0},  # Osaka: too far
        {"lat": 35.661, "lng": 139.701, "confidence": "area", "rank": 1},
        {"lat": 35.662, "lng": 139.702, "confidence": "exact", "rank": 2},
    ]
    best = gc.pick_best(results, hint, 30)
    assert best["rank"] == 2
    assert gc.pick_best(results[:1], hint, 30) is None


def test_offline_geocoder_uses_cache(tmp_path):
    cache = tmp_path / "geo.json"
    g = gc.Geocoder(str(cache), offline=True)
    g.cache["n|jp|一蘭 渋谷店 東京"] = [
        {"lat": 35.6611, "lng": 139.701, "display_name": "一蘭 澀谷店, 東京", "name": "一蘭 澀谷店",
         "confidence": "exact", "source": "nominatim", "rank": 0}
    ]
    hit = g.locate({"name": "一兰拉面", "nameLocal": "一蘭 渋谷店", "city": "東京", "country": "jp",
                    "lat": 35.66, "lng": 139.70})
    assert hit["confidence"] == "exact"
    assert hit["lat"] == 35.6611
    out = gc.geocode_batch([{"name": "没有的店", "city": "東京", "country": "jp", "lat": 35.66, "lng": 139.7}], g)
    assert "geo" not in out[0] and out[0]["lat"] == 35.66
    assert cache.exists()


def test_batch_skips_chains_and_keeps_pinned_estimates(tmp_path):
    g = gc.Geocoder(str(tmp_path / "geo.json"), offline=True)
    g.cache["n|jp|東京ディズニーシー 东京"] = [
        {"lat": 35.6276, "lng": 139.8924, "display_name": "連絡通路", "name": "連絡通路", "confidence": "exact",
         "source": "nominatim", "rank": 0}
    ]
    g.cache["n|jp|一蘭 东京"] = [
        {"lat": 35.73, "lng": 139.71, "display_name": "一蘭 池袋", "name": "一蘭", "confidence": "exact",
         "source": "nominatim", "rank": 0}
    ]
    sea, ramen = gc.geocode_batch([
        {"name": "东京迪士尼海洋", "nameLocal": "東京ディズニーシー", "city": "东京", "country": "jp",
         "lat": 35.6267, "lng": 139.8851, "coordConfidence": "exact"},
        {"name": "一兰拉面", "nameLocal": "一蘭", "city": "东京", "country": "jp", "chain": True, "lat": None, "lng": None},
    ], g)
    assert (sea["lat"], sea["lng"]) == (35.6267, 139.8851) and "geo" not in sea
    assert ramen["lat"] is None and "geo" not in ramen
