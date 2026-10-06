#!/usr/bin/env python3
"""Exchange rates for showing trip prices in RM (or another home currency).

    python tools/fx_rates.py                 # base MYR
    python tools/fx_rates.py --base SGD --out .cache/fx.json

Prints {"base": "MYR", "date": "YYYY-MM-DD", "source": ..., "rates": {"JPY": 38.7, ...}} where
1 base = rate units of that currency. Write it to the app's database as `meta/fx`; the app converts
local prices with amount / rate. Sources: open.er-api.com (ExchangeRate-API, free, attribution
required), falling back to Frankfurter (ECB rates, fewer currencies).
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone

CURRENCIES = ["JPY", "KRW", "CNY", "TWD", "HKD", "MOP", "THB", "SGD", "MYR", "VND", "IDR", "PHP",
              "USD", "EUR", "GBP", "AUD", "NZD", "CHF", "CAD", "AED", "TRY", "INR"]


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "travel-planner/0.1"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def parse_er_api(data: dict, base: str) -> dict | None:
    if data.get("result") != "success" or not data.get("rates"):
        return None
    ts = data.get("time_last_update_unix")
    date = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat() if ts else ""
    rates = {c: round(float(v), 6) for c, v in data["rates"].items() if c in CURRENCIES and c != base}
    return {"base": base, "date": date, "source": "ExchangeRate-API (open.er-api.com)", "rates": rates}


def parse_frankfurter(data: dict, base: str) -> dict | None:
    if not data.get("rates"):
        return None
    rates = {c: round(float(v), 6) for c, v in data["rates"].items() if c in CURRENCIES and c != base}
    return {"base": base, "date": data.get("date", ""), "source": "Frankfurter (European Central Bank)", "rates": rates}


def fetch_rates(base: str = "MYR") -> dict:
    base = base.upper()
    try:
        out = parse_er_api(get_json(f"https://open.er-api.com/v6/latest/{base}"), base)
        if out:
            return out
    except Exception:
        pass
    out = parse_frankfurter(get_json(f"https://api.frankfurter.dev/v1/latest?base={base}"), base)
    if not out:
        raise RuntimeError("no exchange-rate source answered")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--base", default="MYR")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    data = fetch_rates(args.base)
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
