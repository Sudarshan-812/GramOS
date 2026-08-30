"""RTI buyer-payment signal-contribution backtest.

NOT a predictive validation - no borrower repayment outcomes exist yet, so this
cannot measure whether the buyer-payment signal predicts NPAs. It is an ABLATION:
every RTI-backed demo enterprise is scored through the deterministic model twice,
once WITH the real RTI buyer_payment signal and once with it removed, holding every
other input identical. It confirms the signal is wired end-to-end, moves the score
in the right direction and magnitude, only fires where real arrears exist, and
tracks real rupee arrears exposure monotonically.

Caveat carried into BACKTEST.md: the non-RTI inputs (financials, climate) for these
demo enterprises are synthetic and were seeded per-taluk scaled to that taluk's real
RTI stress, so the "without RTI" score is not independent of RTI stress. This run
therefore cannot show the signal is ORTHOGONAL to conventional credit features -
that needs a lending partner's real repayment history.

Run:  backend/venv/Scripts/python.exe backend/scripts/backtest_rti_signal.py
Writes: BACKTEST.md inputs to stdout + scripts/backtest_rti_signal_result.json
"""
import asyncio
import json
import os
import sys
from statistics import mean

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import main  # reuse the exact WRIS + buyer_payment resolution the live API uses
import rti_data
from database import get_supabase_client
from engine import calculate_base_score
from models import ClimateProfile, FinancialProfile, RiskAssessmentRequest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RTI_JSON = json.load(
    open(os.path.join(REPO_ROOT, "Ref_data", "rti_cane_arrears_processed.json"), encoding="utf-8")
)
EXPOSURE = RTI_JSON["exposure_by_taluk"]

_RTI_BY_TALUK = rti_data.load_exposure_by_taluk()
_ENT_TO_TALUK = {rti_data.taluk_enterprise_name(t): t for t in _RTI_BY_TALUK}

BANDS = ((75, "CRITICAL"), (50, "HIGH"), (25, "MEDIUM"), (0, "LOW"))


def band(score: int) -> str:
    return next(name for lo, name in BANDS if score >= lo)


async def _score(req: RiskAssessmentRequest) -> int:
    return (await calculate_base_score({"request": req}))["deterministic_score"]


async def build_rows():
    client = get_supabase_client()
    enterprises = client.table("enterprises").select("*").execute().data
    rows = []
    for ent in enterprises:
        taluk = _ENT_TO_TALUK.get(ent["name"])
        if taluk is None:
            continue
        led = (
            client.table("financial_ledgers").select("*").eq("enterprise_id", ent["id"])
            .order("recorded_at", desc=True, nullsfirst=False).limit(1).execute().data[0]
        )
        cli = (
            client.table("climate_snapshots").select("*").eq("enterprise_id", ent["id"])
            .order("recorded_at", desc=True, nullsfirst=False).limit(1).execute().data[0]
        )
        fin = FinancialProfile(
            business_type=ent["business_type"],
            monthly_revenue_inr=led["monthly_revenue_inr"],
            upi_transaction_count=led["upi_transaction_count"],
            avg_ticket_size_inr=led["avg_ticket_size_inr"],
            days_past_due=led["days_past_due"],
            kcc_utilization_pct=led["kcc_limit_utilized_pct"],
        )
        clim = ClimateProfile(
            ndvi_index=cli["ndvi_index"],
            soil_moisture_percentage=cli["soil_moisture_percentage"],
            rainfall_deviation_pct=cli["rainfall_deviation_pct"],
            alpha_earth_embeddings=[0.0] * 64,
        )
        wris = main._WRIS_SNAPSHOTS_BY_DISTRICT.get(
            main._ENTERPRISE_TO_WRIS_DISTRICT.get(ent["name"], "")
        )
        bp = _RTI_BY_TALUK[taluk]
        common = dict(enterprise_name=ent["name"], financials=fin, climate=clim, wris_climate=wris)
        s_with = await _score(RiskAssessmentRequest(**common, buyer_payment=bp))
        s_without = await _score(RiskAssessmentRequest(**common, buyer_payment=None))
        meta = EXPOSURE[taluk]
        rows.append({
            "taluk": taluk,
            "district": meta["district"],
            "mills": meta["mill_count"],
            "exposure_cr": round(meta["weighted_exposure_cr"], 2),
            "flag": bp.stress_flag,
            "days_past_due": led["days_past_due"],
            "kcc_pct": round(led["kcc_limit_utilized_pct"], 1),
            "rain_dev_pct": round(cli["rainfall_deviation_pct"], 1),
            "gw_level_m": round(wris.groundwater_avg_level_m, 1) if wris and wris.groundwater_avg_level_m is not None else None,
            "score_without_rti": s_without,
            "score_with_rti": s_with,
            "delta": s_with - s_without,
            "band_without": band(s_without),
            "band_with": band(s_with),
            "band_changed": band(s_with) != band(s_without),
        })
    rows.sort(key=lambda r: (-r["exposure_cr"], r["taluk"]))
    return rows


def spearman(xs, ys):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    rx, ry = rank(xs), rank(ys)
    mx, my = mean(rx), mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return round(num / den, 3) if den else None


def main_():
    rows = asyncio.run(build_rows())
    by_flag = {}
    for r in rows:
        by_flag.setdefault(r["flag"], []).append(r)
    summary = {
        "n_enterprises": len(rows),
        "n_by_flag": {f: len(v) for f, v in sorted(by_flag.items())},
        "band_changes": sum(r["band_changed"] for r in rows),
        "band_changes_upward": sum(r["band_changed"] and r["delta"] > 0 for r in rows),
        "mean_delta_by_flag": {f: round(mean(x["delta"] for x in v), 1) for f, v in sorted(by_flag.items())},
        "mean_score_without_by_flag": {f: round(mean(x["score_without_rti"] for x in v), 1) for f, v in sorted(by_flag.items())},
        "mean_score_with_by_flag": {f: round(mean(x["score_with_rti"] for x in v), 1) for f, v in sorted(by_flag.items())},
        "spearman_exposure_vs_score_with": spearman([r["exposure_cr"] for r in rows], [r["score_with_rti"] for r in rows]),
        "spearman_exposure_vs_score_without": spearman([r["exposure_cr"] for r in rows], [r["score_without_rti"] for r in rows]),
    }
    out = {"generated": "backtest_rti_signal.py", "rows": rows, "summary": summary}
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backtest_rti_signal_result.json")
    json.dump(out, open(path, "w"), indent=2)
    print(json.dumps(summary, indent=2))
    print(f"\nrows + summary written to {path}")


if __name__ == "__main__":
    main_()
