---
name: plan-trip
description: 排行程 — plan a day-by-day itinerary for one city or several (东京 → 京都 → 大阪) from the places saved in the 拔草计划 app, with real geocoding, route ordering, transport and fares between stops, costs converted to RM, and write it into the app's 行程 tab. Use when the user asks to plan a trip, 排行程, 安排 N 天, or runs /plan-trip.
---

# Plan a trip from saved places

Read `CLAUDE.md` for the trip schema and `travel.config.json` for `appUrl`.

## 1. Settle the brief

Needed: the cities in visiting order and the number of days (per city when there are several). Useful: start date,
where they sleep in each city (a city without a hotel is a day trip from the previous one), pace
(`relaxed | normal | packed`), transport (`transit | walk | taxi | drive`), budget in RM, wishes (Disney on day 2,
elderly parents, sunsets). Ask only for what is missing and matters; otherwise default to 3 days, `normal`,
`transit`, and split days over cities by how many places each has (at least one day each).

## 2. Collect the places

`ArtifactData` `list` on `places` (follow `next_cursor`). Keep places in those cities (same spelling; also treat obvious
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

Run it once per city with that city's days. This is the same grouping the app proposes. Treat it as a starting
point and adjust for:

- opening hours and closing days (check the start date's weekday; WebSearch a place when unsure),
- best times (markets in the morning, viewpoints at sunset, night views after dark),
- meals at meal times (lunch 11:30–13:30, dinner 18:00–20:00), cafés in the afternoon,
- pace: relaxed 3–4 stops a day, normal 4–6, packed 6–8 (meals included).

## 5. Write each leg

For every stop, `travel` = how to get there from the previous stop (first stop: from that day's hotel): `mode`,
`minutes`, `detail` with the actual line and stations or walking distance, and `fare` = per-person fare as a number in
the local currency (0 when walking, null when unknown). Use real lines you are confident about; otherwise give the
most likely option and append （出发前用地图确认）. Give each stop `kind: "visit"` and `spend` = rough per-person
ticket or meal cost (0 free, null unknown). On the day you change city, the first stop is a transfer: `kind:
"transfer"`, `placeId: null`, `name: "东京 → 京都"`, `category: "transport"`, `travel` = the inter-city train/bus/flight
with its fare, `what` = luggage or check-in advice. You may add a few nearby meal suggestions as stops with
`placeId: null`, `"suggested": true`. Places that do not fit go to `unplaced` with a reason. Add 3–6 practical `tips`
(transit cards or passes worth buying, reservations, cash, weather). Set `plan.currency` (JPY, KRW, THB…) and
`plan.bases` (one per city with a hotel, with coordinates).

## 6. Save

`ArtifactData` `set` on `trips/<t_id>` with the full trip document from `CLAUDE.md`: `cities`, `stays`, `budget` (RM or
null), `placeIds` = every saved place you considered, `changed: []`, `skipped: []`, `savedVia: "agent"`,
`createdBy: null`, `example: false`, timestamps in ms, `days[].city` and `days[].date` filled. Without ArtifactData,
write `exports/<date>-<city>.json` as `{"trips": [...]}` for 设置 → 导入备份.

Then keep the app's supporting data fresh:

- **Exchange rates**: `python3 tools/fx_rates.py --base MYR --out .cache/fx.json`; `get` `meta/fx` and `update` it with
  `if_version` (`base`, `date`, `source`, `rates`) — never touch `manual`. `set` it if it does not exist yet.
- **Basemaps**: for each city without a `maps` document covering its stops, run `tools/city_map.mjs` and upload as in
  `/collect` step 7.

## 7. Report

Summarize each day in one line (city · area: stop → stop → stop), the estimated per-person cost in local currency and
RM, and link the app, where the photo timeline, the route map, per-leg navigation links and「用 AI 优化这一天」live.
