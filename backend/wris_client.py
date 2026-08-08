"""Client for the India-WRIS Dataset API (indiawris.gov.in) - real rainfall and
groundwater data, no API key required. Confirmed working 2026-08-08 against
https://indiawris.gov.in/Dataset/{RainFall,Ground Water Level,...}.

Not imported by the live app yet - see backend/scripts/fetch_wris_climate_data.py for a
one-off pull, and CLAUDE.md / project history for the plan to eventually replace the
synthetic rainfall_deviation_pct / soil_moisture_percentage in models.ClimateProfile.

Gotcha: this API's district naming is NOT consistently pre- or post-2024-renaming -
confirmed by live query on 2026-08-08: Belagavi only returns data under the legacy name
"Belgaum" and Vijayapura only under "Bijapur", but Bagalkote only returns data under its
CURRENT name "Bagalkote" ("Bagalkot" returns nothing). DISTRICT_NAME_MAP below reflects
that per-district reality, not a general renaming rule - don't assume it generalizes to
other districts without testing them individually.
"""

import requests

BASE_URL = "https://indiawris.gov.in/Dataset"
DEFAULT_TIMEOUT_SECONDS = 45
MAX_PAGE_SIZE = 1000

# Current official name -> name this API expects (only where they differ; see the
# module docstring - this is NOT a uniform old-name mapping).
DISTRICT_NAME_MAP = {
    "Belagavi": "Belgaum",
    "Vijayapura": "Bijapur",
}


def _fetch_page(
    dataset: str, district: str, agency: str, start_date: str, end_date: str, state: str, page: int, size: int
) -> list[dict]:
    resolved_district = DISTRICT_NAME_MAP.get(district, district)
    response = requests.post(
        f"{BASE_URL}/{dataset}",
        params={
            "stateName": state,
            "districtName": resolved_district,
            "agencyName": agency,
            "startdate": start_date,
            "enddate": end_date,
            "download": False,
            "page": page,
            "size": size,
        },
        headers={"Accept": "application/json"},
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("statusCode") != 200:
        return []
    return body.get("data", [])


def fetch_dataset(
    dataset: str,
    district: str,
    agency: str,
    start_date: str,
    end_date: str,
    state: str = "Karnataka",
    max_pages: int = 3,
) -> list[dict]:
    """POSTs to /Dataset/{dataset}, paginating (size=1000 per page, the API's max)
    until a short page signals the end, and returns every row combined. A 200 HTTP
    response can still carry statusCode 500 for "no data found" - that's treated as
    an empty page, not an error. max_pages is a safety cap (20 * 1000 = 20k rows).

    This is a real, occasionally-flaky government server - a page request timing out
    partway through pagination is expected, not exceptional. If a page fails after
    retrying, whatever was already fetched is returned rather than raising, since a
    partial real total beats crashing the whole pull over one slow page."""
    all_rows: list[dict] = []
    for page in range(max_pages):
        rows = None
        for attempt in range(2):
            try:
                rows = _fetch_page(dataset, district, agency, start_date, end_date, state, page, MAX_PAGE_SIZE)
                break
            except requests.exceptions.RequestException as exc:
                print(f"  (page {page} attempt {attempt + 1}/2 failed: {exc})")
        if rows is None:
            print(f"  Giving up on page {page} after 2 attempts; returning {len(all_rows)} rows fetched so far.")
            break
        all_rows.extend(rows)
        if len(rows) < MAX_PAGE_SIZE:
            break
    return all_rows


def fetch_rainfall(district: str, start_date: str, end_date: str, agency: str = "CWC") -> list[dict]:
    return fetch_dataset("RainFall", district, agency, start_date, end_date)


def fetch_groundwater(district: str, start_date: str, end_date: str, agency: str = "CGWB") -> list[dict]:
    return fetch_dataset("Ground Water Level", district, agency, start_date, end_date)


def fetch_soil_moisture(
    district: str, start_date: str, end_date: str, agency: str = "NRSC VIC MODEL"
) -> list[dict]:
    return fetch_dataset("Soil Moisture", district, agency, start_date, end_date)
