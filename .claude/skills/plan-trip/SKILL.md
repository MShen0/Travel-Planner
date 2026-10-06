---
name: plan-trip
description: 排行程 — plan a day-by-day itinerary for one city from the places saved in the 拔草计划 app, with real geocoding, route ordering and transport between stops, and write it into the app's 行程 tab. Use when the user asks to plan a trip, 排行程, 安排 N 天, or runs /plan-trip.
---

# Plan a trip from saved places

Read `CLAUDE.md` for the trip schema and `travel.config.json` for `appUrl`.

## 1. Settle the brief

Needed: city, number of days. Useful: start date, where they sleep, pace (`relaxed | normal | packed`), transport
(`transit | walk | taxi | drive`), wishes (Disney on day 2, elderly parents, sunsets). Ask only for what is missing
and matters; otherwise default to 3 days, `normal`, `transit`.

## 2. Collect the places

`ArtifactData` `list` on `places` (follow `next_cursor`). Keep places in that city (same spelling; also treat obvious
variants such as 東京/东京/Tokyo as the same city). Leave out `status: "visited"` unless asked; places with
`status: "want"` are must-includes.

## 3. Coordinates

Places with `lat: null` or `coordConfidence: "area"` and the hotel: put them in a JSON file and run
`python3 tools/geocode.py --batch in.json --out out.json`. Use the improved coordinates for planning (you may also
write them back to those place documents with `update` + `if_version`, touching only `lat`, `lng`, `coordConfidence`,
`updatedAt`).

## 4. Group by area

```bash
python3 tools/trip_helper.py .cache/trip-places.json --days N --base <hotel lat,lng>
```

This is the same grouping the app proposes. Treat it as a starting point and adjust for:

- opening hours and closing days (check the start date's weekday; WebSearch a place when unsure),
- best times (markets in the morning, viewpoints at sunset, night views after dark),
- meals at meal times (lunch 11:30–13:30, dinner 18:00–20:00), cafés in the afternoon,
- pace: relaxed 3–4 stops a day, normal 4–6, packed 6–8 (meals included).

## 5. Write each leg

For every stop, `travel` = how to get there from the previous stop (first stop: from the hotel): `mode`, `minutes`,
`detail` with the actual line and stations or walking distance, `cost` in local currency. Use real lines you are
confident about; otherwise give the most likely option and append （出发前用地图确认）. You may add a few nearby meal
suggestions as stops with `placeId: null`, `"suggested": true`. Places that do not fit go to `unplaced` with a reason.
Add 3–6 practical `tips` (transit cards or passes worth buying, reservations, cash, weather).

## 6. Save

`ArtifactData` `set` on `trips/<t_id>` with the full trip document from `CLAUDE.md` (`placeIds` = every saved place
you considered, `savedVia: "agent"`, `example: false`, timestamps in ms, `days[].date` filled when there is a start
date). Without ArtifactData, write `exports/<date>-<city>.json` as `{"trips": [...]}` for 设置 → 导入备份.

## 7. Report

Summarize each day in one line (area: stop → stop → stop) and link the app, where the map, per-leg navigation links
and the "想调整？" box live.
