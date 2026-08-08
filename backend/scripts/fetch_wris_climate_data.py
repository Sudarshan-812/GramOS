"""One-off: pull real rainfall and groundwater-level data from India-WRIS for GramOS's
3 target districts (Belagavi, Bagalkote, Vijayapura) and print/save a summary.

This is a research/staging pull, NOT wired into the live risk engine yet - main.py and
engine.py still use synthetic ClimateProfile data. Turning this into a real
rainfall_deviation_pct / soil_moisture_percentage feed is a separate follow-up (needs a
defined historical-baseline methodology for "deviation", plus a district->enterprise
lookup the same shape as _MOCK_BUYER_PAYMENT_BY_ENTERPRISE_NAME in main.py).

Run with: python backend/scripts/fetch_wris_climate_data.py
"""

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from wris_client import fetch_groundwater, fetch_rainfall, fetch_soil_moisture

REPO_ROOT = BACKEND_DIR.parent
OUTPUT_PATH = REPO_ROOT / "Ref_data" / "wris_climate_data.json"

DISTRICTS = ["Belagavi", "Bagalkote", "Vijayapura"]

# Data recency varies a lot by station; the live API had nothing for the last 14 days
# as of 2026-08-08. A full calendar-year pull (365 days x up to 4x/day per station)
# means deep pagination against a slow, occasionally-flaky government server - a first
# attempt at that hung for 20+ minutes with no output and had to be killed. A single
# month is enough to prove the pipeline works and stays fast (confirmed <2s in earlier
# ad-hoc testing); widen the window later once this is actually wired somewhere that
# can tolerate a slow background job.
START_DATE = "2025-06-01"
END_DATE = "2025-06-30"

# Agencies to try per dataset, in order, until one returns data (confirmed by live
# testing 2026-08-08: CWC works for rainfall in Belgaum/Bijapur but not Bagalkot;
# coverage is genuinely per-district, not a fixed agency-per-dataset rule).
RAINFALL_AGENCIES = ["CWC", "IMD", "KSNDMC"]
GROUNDWATER_AGENCIES = ["CGWB", "KSNDMC"]
SOIL_MOISTURE_AGENCIES = ["NRSC VIC MODEL", "IMD"]


def try_agencies(fetch_fn, district: str, agencies: list[str]) -> tuple[str | None, list[dict]]:
    for agency in agencies:
        rows = fetch_fn(district, START_DATE, END_DATE, agency=agency)
        if rows:
            return agency, rows
    return None, []


# The RainFall dataset mixes several reading types under one description field, some
# of which are cumulative/telemetric estimates rather than a plain per-interval gauge
# reading (e.g. "INSAT-Rain acumm" hit 1007mm in a single row for one station - not a
# real instantaneous rainfall value). Naively summing every row inflates totals into
# physically impossible numbers (confirmed: raw sum for Bagalkote/June came out to
# 33,583mm - no monthly rainfall total on Earth has ever exceeded ~9,300mm). Only the
# manual standard rain gauge readings are safe to sum.
RAINFALL_TRUSTED_DESCRIPTION = "MANUAL-Rainfall - SRG(Standard Rain Gauge)"


def summarize_rainfall(rows: list[dict]) -> dict:
    trusted = [r for r in rows if r.get("description") == RAINFALL_TRUSTED_DESCRIPTION]
    excluded = len(rows) - len(trusted)
    values = [r["dataValue"] for r in trusted if r.get("dataValue") is not None]
    stations = sorted({r["stationName"] for r in trusted})
    tehsils = sorted({r["tehsil"] for r in trusted if r.get("tehsil") and r["tehsil"] != "-"})
    return {
        "readings": len(values),
        "excluded_non_gauge_readings": excluded,
        "stations": stations,
        "tehsils": tehsils,
        "total_mm": round(sum(values), 2),
    }


def summarize_soil_moisture(rows: list[dict]) -> dict:
    """Soil Moisture rows have a different, simpler schema than Rainfall/Groundwater -
    already district-aggregated (date + dataValue only, no per-station breakdown)."""
    values = [r["dataValue"] for r in rows if r.get("dataValue") is not None]
    dates = sorted({r["date"] for r in rows if r.get("date")})
    return {
        "readings": len(values),
        "date_range": [dates[0], dates[-1]] if dates else [],
        "avg_pct": round(sum(values) / len(values), 2) if values else None,
    }


def summarize_groundwater(rows: list[dict]) -> dict:
    values = [r["dataValue"] for r in rows if r.get("dataValue") is not None]
    stations = sorted({r["stationName"] for r in rows})
    tehsils = sorted({r["tehsil"] for r in rows if r.get("tehsil") and r["tehsil"] != "-"})
    return {
        "readings": len(values),
        "stations": stations,
        "tehsils": tehsils,
        "avg_level_m": round(sum(values) / len(values), 2) if values else None,
        "min_level_m": min(values) if values else None,
        "max_level_m": max(values) if values else None,
    }


def main() -> None:
    results: dict[str, dict] = {}

    for district in DISTRICTS:
        print(f"\n=== {district} ({START_DATE} to {END_DATE}) ===")
        district_result: dict = {}

        agency, rain_rows = try_agencies(fetch_rainfall, district, RAINFALL_AGENCIES)
        if rain_rows:
            summary = summarize_rainfall(rain_rows)
            print(f"Rainfall: agency={agency}, {summary}")
            district_result["rainfall"] = {"agency": agency, "summary": summary, "raw": rain_rows}
        else:
            print(f"Rainfall: no data from any of {RAINFALL_AGENCIES}")
            district_result["rainfall"] = None

        agency, gw_rows = try_agencies(fetch_groundwater, district, GROUNDWATER_AGENCIES)
        if gw_rows:
            summary = summarize_groundwater(gw_rows)
            print(f"Groundwater: agency={agency}, {summary}")
            district_result["groundwater"] = {"agency": agency, "summary": summary, "raw": gw_rows}
        else:
            print(f"Groundwater: no data from any of {GROUNDWATER_AGENCIES}")
            district_result["groundwater"] = None

        agency, soil_rows = try_agencies(fetch_soil_moisture, district, SOIL_MOISTURE_AGENCIES)
        if soil_rows:
            summary = summarize_soil_moisture(soil_rows)
            print(f"Soil moisture: agency={agency}, {summary}")
            district_result["soil_moisture"] = {"agency": agency, "summary": summary, "raw": soil_rows}
        else:
            print(f"Soil moisture: no data from any of {SOIL_MOISTURE_AGENCIES}")
            district_result["soil_moisture"] = None

        results[district] = district_result

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"\nSaved full raw + summary data to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
