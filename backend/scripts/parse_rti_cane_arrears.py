"""Parse the RTI response on 2025-26 season cane crushing/payment arrears (Belagavi,
Bagalkote, Vijayapura districts) into structured mill- and taluk-level JSON.

Source: Ref_data/rti_cane_arrears.csv, the certified data received against RTI
registration SECCI/R/2026/60049 (filed 2026-08-05 via rtionline.karnataka.gov.in,
routed through the Secretariat - Commerce and Industries Dept / Cane Commissionerate).
This is the first real Tier-1 data for the buyer_payment_risk signal described in
Ref_data/GramOS_Cane_Arrears_Dataset_v1.xlsx's methodology doc - see that workbook's
Sources tab for S01-S04.

Note this is a SEASON-END snapshot (every mill's "Date of close" already fell in
Feb-Apr 2026) - it validates which mills paid growers in full and which didn't, but on
its own cannot backtest the "60-120 day lead time before loan stress" hypothesis, which
needs multiple time-stamped snapshots across a season.

Run with: python backend/scripts/parse_rti_cane_arrears.py
"""

import csv
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_PATH = REPO_ROOT / "Ref_data" / "rti_cane_arrears.csv"
OUTPUT_PATH = REPO_ROOT / "Ref_data" / "rti_cane_arrears_processed.json"

RTI_SOURCE = {
    "source": "Karnataka RTI response - season-end cane crushing/payment arrears",
    "rti_registration_number": "SECCI/R/2026/60049",
    "rti_online_reference": "865695905",
    "season": "2025-26",
    "districts": ["Belagavi", "Bagalkote", "Vijayapura"],
    "confidence": "High",
}

# Official taluks of the 3 covered districts. "BELAGAVI" is both a district name and a
# taluk name, so a plain substring match against the whole address (e.g. "...BELAGAVI
# DISTRICT") would wrongly tag every mill in the district as being in Belagavi taluk.
# extract_taluk() below only matches within the text immediately preceding the literal
# word "TALUK", never against the free-standing district name.
KNOWN_TALUKS = [
    "BAILAHONGALA", "BAILAHONGAL", "CHIKKODI", "KHANAPUR", "RAMDURG", "SAVADATTI",
    "HUKKERI", "NIPPANI", "BELAGAVI", "ATHANI", "RAIBAG", "GOKAK",
    "JAMKHANDI", "MUDHOL", "BAGALKOTE", "BAGALKOT", "BADAMI", "BILAGI",
    "SINDAGI", "ALMEL", "INDI",
]

# Alternate spellings seen in the source CSV, mapped to the canonical name above.
TALUK_ALIASES = {"RAIBAGH": "RAIBAG", "SAUNDATTI": "SAVADATTI"}
_ALL_TALUK_SPELLINGS = KNOWN_TALUKS + list(TALUK_ALIASES.keys())

# Most rows write "<taluk> TALUK" (taluk name before the keyword), but a few instead
# write "TALUK <taluk>" or "<village> TALUK <taluk>" (e.g. "...UDUPUDI TALUK RAMDURG
# BELAGAVI DISTRICT", "...TALUK SAUNDATTI, BELAGAVI DISTRICT"). Checking both the
# word-run immediately before AND immediately after "TALUK" covers both phrasings.
# Some mills in the source CSV don't use the word "TALUK" at all, or name only a
# village with no taluk (e.g. "NANDI SSK LTD., VIJAYAPURA DISTRICT") - those are
# intentionally left unmatched rather than guessed, per the project's
# no-GPS/no-unverified-locality policy; see the "needs_manual_taluk_lookup" list this
# script prints and writes to the output JSON.
TALUK_BEFORE_RE = re.compile(r"([A-Z][A-Z.\-]*(?:\s+[A-Z][A-Z.\-]*)*)\s+TALUK\b")
TALUK_AFTER_RE = re.compile(r"\bTALUK\s+([A-Z][A-Z.\-]*(?:\s+[A-Z][A-Z.\-]*)*)")

# HIGH/MEDIUM/LOW thresholds on absolute balance owed to growers (Rs crore), not
# percentage unpaid - a 1% shortfall on a large mill can still be several crore rupees
# still not in a farmer's hands, which is what actually drives downstream cash-flow
# stress. Chosen against this dataset's actual distribution (see memory /
# conversation analysis): 35/53 mills are fully paid (LOW), the worst 8 owe >= Rs 5cr.
HIGH_BALANCE_CR = 5.0


def mill_stress_flag(balance_cr: float) -> str:
    if balance_cr <= 0:
        return "LOW"
    if balance_cr >= HIGH_BALANCE_CR:
        return "HIGH"
    return "MEDIUM"


def taluk_stress_flag(weighted_exposure_cr: float) -> str:
    if weighted_exposure_cr <= 0:
        return "LOW"
    if weighted_exposure_cr >= HIGH_BALANCE_CR:
        return "HIGH"
    return "MEDIUM"


def _closest_taluk_in_window(window: str, from_end: bool) -> tuple[int, str] | None:
    """Returns (distance_to_taluk_keyword, canonical_taluk) for the closest known-taluk
    spelling found in `window`, or None. `from_end` = True for the "before TALUK" window
    (closeness = how near the match ends to the window's end); False for the "after
    TALUK" window (closeness = how near the match starts to the window's start)."""
    best: tuple[int, str] | None = None
    for spelling in _ALL_TALUK_SPELLINGS:
        idx = window.rfind(spelling) if from_end else window.find(spelling)
        if idx == -1:
            continue
        distance = len(window) - (idx + len(spelling)) if from_end else idx
        canonical = TALUK_ALIASES.get(spelling, spelling)
        if best is None or distance < best[0]:
            best = (distance, canonical)
    return best


def extract_taluk(factory_name: str) -> str | None:
    upper = factory_name.upper()
    candidates: list[tuple[int, str]] = []

    before = TALUK_BEFORE_RE.search(upper)
    if before is not None:
        found = _closest_taluk_in_window(before.group(1), from_end=True)
        if found is not None:
            candidates.append(found)

    after = TALUK_AFTER_RE.search(upper)
    if after is not None:
        found = _closest_taluk_in_window(after.group(1), from_end=False)
        if found is not None:
            candidates.append(found)

    if not candidates:
        return None
    return min(candidates, key=lambda c: c[0])[1].title()


def parse_mills(rows: list[list[str]]) -> list[dict]:
    mills = []
    current_district = None

    for row in rows:
        sl_no, name = row[0].strip(), row[1].strip()

        if not sl_no and name and name != "TOTAL":
            current_district = name.replace(" DISTRICT", "").title()
            continue
        if not sl_no.isdigit():
            continue

        (
            _, _, tcd, crushed_mt, sugar_mt, recovery_pct, rate_declared, rate_full,
            payable_lakhs, paid_lakhs, balance_lakhs, pct_paid, start_date, close_date,
        ) = row

        balance_cr = round(float(balance_lakhs) / 100, 2)
        mills.append(
            {
                "sl_no": int(sl_no),
                "mill_name": name,
                "district": current_district,
                "taluk": extract_taluk(name),
                "crushing_capacity_tcd": int(tcd),
                "cane_crushed_mt": int(crushed_mt),
                "sugar_produced_mt": int(sugar_mt),
                "recovery_pct": float(recovery_pct),
                "cane_rate_declared_inr_per_mt": float(rate_declared),
                "cane_rate_with_ht_inr_per_mt": float(rate_full),
                "amount_payable_cr": round(float(payable_lakhs) / 100, 2),
                "amount_paid_cr": round(float(paid_lakhs) / 100, 2),
                "balance_cr": balance_cr,
                "pct_paid": float(pct_paid),
                "stress_flag": mill_stress_flag(balance_cr),
                "season_start": start_date,
                "season_close": close_date,
            }
        )

    return mills


def rollup_by_taluk(mills: list[dict]) -> dict:
    by_taluk: dict[str, list[dict]] = {}
    for mill in mills:
        if mill["taluk"] is None:
            continue
        by_taluk.setdefault(mill["taluk"], []).append(mill)

    exposure = {}
    for taluk, taluk_mills in by_taluk.items():
        weighted_exposure_cr = round(sum(m["balance_cr"] for m in taluk_mills), 2)
        dominant_mill = max(taluk_mills, key=lambda m: m["balance_cr"])
        exposure[taluk] = {
            "taluk": taluk,
            "district": dominant_mill["district"],
            "mill_count": len(taluk_mills),
            "mill_names": [m["mill_name"] for m in taluk_mills],
            "dominant_mill_name": dominant_mill["mill_name"],
            "weighted_exposure_cr": weighted_exposure_cr,
            "stress_flag": taluk_stress_flag(weighted_exposure_cr),
        }

    return exposure


def main() -> None:
    with open(INPUT_PATH, encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]  # drop header row

    mills = parse_mills(rows)
    exposure_by_taluk = rollup_by_taluk(mills)

    unmatched = [m["mill_name"] for m in mills if m["taluk"] is None]
    if unmatched:
        print(f"WARNING: {len(unmatched)} mills had no taluk match (needs manual lookup):")
        for name in unmatched:
            print(f"  - {name}")

    output = {
        "metadata": RTI_SOURCE,
        "mills": mills,
        "exposure_by_taluk": exposure_by_taluk,
        "needs_manual_taluk_lookup": unmatched,
    }

    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nParsed {len(mills)} mills across {len(exposure_by_taluk)} taluks -> {OUTPUT_PATH}")
    print("\nTaluk exposure summary:")
    for taluk, data in sorted(exposure_by_taluk.items(), key=lambda kv: -kv[1]["weighted_exposure_cr"]):
        print(f"  {taluk:15s} {data['stress_flag']:6s} Rs {data['weighted_exposure_cr']:6.2f} cr  ({data['mill_count']} mill(s))")


if __name__ == "__main__":
    main()
