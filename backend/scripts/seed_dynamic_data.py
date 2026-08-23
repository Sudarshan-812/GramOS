"""Backfills 30 days of synthetic time-series activity for the enterprises seeded by
init_supabase.py: one ClimateSnapshot row and one aggregated daily FinancialLedger row per
enterprise per day.

Requires backend/scripts/init_supabase.py to have already been run (enterprises must exist).

Adds a `recorded_at` column to financial_ledgers / climate_snapshots (the Phase 1 schema had
no time dimension, which a time-series backfill needs) plus a UNIQUE(enterprise_id, recorded_at)
constraint, then upserts on that key so the script is safe to re-run.

Run with: python backend/scripts/seed_dynamic_data.py
"""

import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

import psycopg2

from database import get_supabase_client
from seed_profiles import MOCK_PROFILES

BACKFILL_DAYS = 30

MIGRATION_SQL = """
ALTER TABLE climate_snapshots ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP;
ALTER TABLE financial_ledgers ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'climate_snapshots_enterprise_recorded_at_key'
    ) THEN
        ALTER TABLE climate_snapshots
            ADD CONSTRAINT climate_snapshots_enterprise_recorded_at_key
            UNIQUE (enterprise_id, recorded_at);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'financial_ledgers_enterprise_recorded_at_key'
    ) THEN
        ALTER TABLE financial_ledgers
            ADD CONSTRAINT financial_ledgers_enterprise_recorded_at_key
            UNIQUE (enterprise_id, recorded_at);
    END IF;
END $$;
"""


def add_time_series_columns() -> None:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to backend/.env (see .env.example); required to "
            "add the recorded_at column via a direct Postgres connection."
        )
    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(MIGRATION_SQL)
        print("Migration ready: recorded_at column + unique constraint on both tables")
    finally:
        conn.close()


def _clamp(value: float, lo: float | None, hi: float | None) -> float:
    if lo is not None:
        value = max(lo, value)
    if hi is not None:
        value = min(hi, value)
    return value


def mean_reverting_walk(anchor: float, days: int, noise_std: float, theta: float = 0.3, lo=None, hi=None) -> list[float]:
    """Random walk that fluctuates around a fixed anchor value (no forced trend)."""
    values = [_clamp(anchor + random.gauss(0, noise_std), lo, hi)]
    for _ in range(days - 1):
        prev = values[-1]
        nxt = prev + theta * (anchor - prev) + random.gauss(0, noise_std)
        values.append(_clamp(nxt, lo, hi))
    return values


def generate_climate_series(anchor) -> list[dict]:
    """anchor is a ClimateProfile: today's already-known values from mock_data."""
    ndvi = mean_reverting_walk(anchor.ndvi_index, BACKFILL_DAYS, noise_std=0.02, lo=0.0, hi=1.0)
    soil = mean_reverting_walk(anchor.soil_moisture_percentage, BACKFILL_DAYS, noise_std=1.5, lo=0.0, hi=100.0)
    rain = mean_reverting_walk(anchor.rainfall_deviation_pct, BACKFILL_DAYS, noise_std=2.0, lo=-60.0, hi=60.0)

    return [
        {"ndvi_index": round(ndvi[i], 4), "soil_moisture_percentage": round(soil[i], 2), "rainfall_deviation_pct": round(rain[i], 2)}
        for i in range(BACKFILL_DAYS)
    ]


DEFAULT_FINANCIAL_PROFILE = {"txn_count": (150, 400), "ticket_size": (500.0, 900.0)}


def generate_financial_series(anchor) -> list[dict]:
    """anchor is a FinancialProfile: today's already-known values from mock_data."""
    cfg = DEFAULT_FINANCIAL_PROFILE

    txn_counts = [random.randint(*cfg["txn_count"]) for _ in range(BACKFILL_DAYS)]
    ticket_sizes = mean_reverting_walk(anchor.avg_ticket_size_inr, BACKFILL_DAYS, noise_std=15.0, theta=0.4, lo=1.0)

    kcc = mean_reverting_walk(anchor.kcc_utilization_pct, BACKFILL_DAYS, noise_std=2.0, lo=0.0, hi=100.0)
    # Mild, non-trending jitter around the known current DPD.
    dpd = [max(0, round(anchor.days_past_due + random.gauss(0, 1.0))) for _ in range(BACKFILL_DAYS)]

    rows = []
    for i in range(BACKFILL_DAYS):
        ticket = round(ticket_sizes[i], 2)
        count = txn_counts[i]
        rows.append(
            {
                "monthly_revenue_inr": round(ticket * count, 2),
                "upi_transaction_count": count,
                "avg_ticket_size_inr": ticket,
                "days_past_due": dpd[i],
                "kcc_limit_utilized_pct": round(kcc[i], 2),
            }
        )
    return rows


def backfill() -> None:
    client = get_supabase_client()
    enterprises = client.table("enterprises").select("id, name, business_type").execute().data
    if not enterprises:
        raise RuntimeError(
            "No enterprises found in Supabase. Run backend/scripts/init_supabase.py first."
        )

    mock_by_name = {factory().enterprise_name: factory() for factory in MOCK_PROFILES.values()}

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    dates = [today - timedelta(days=BACKFILL_DAYS - 1 - i) for i in range(BACKFILL_DAYS)]

    all_climate_rows = []
    all_financial_rows = []

    for ent in enterprises:
        profile = mock_by_name.get(ent["name"])
        if profile is None:
            print(f"Skipping '{ent['name']}': no matching mock_data profile to anchor against.")
            continue

        climate_series = generate_climate_series(profile.climate)
        financial_series = generate_financial_series(profile.financials)

        for day, climate_day, financial_day in zip(dates, climate_series, financial_series):
            recorded_at = day.isoformat()
            all_climate_rows.append(
                {"id": str(uuid.uuid4()), "enterprise_id": ent["id"], "recorded_at": recorded_at, **climate_day}
            )
            all_financial_rows.append(
                {"id": str(uuid.uuid4()), "enterprise_id": ent["id"], "recorded_at": recorded_at, **financial_day}
            )

        print(f"Generated {BACKFILL_DAYS} days for: {ent['name']}")

    client.table("climate_snapshots").upsert(
        all_climate_rows, on_conflict="enterprise_id,recorded_at"
    ).execute()
    client.table("financial_ledgers").upsert(
        all_financial_rows, on_conflict="enterprise_id,recorded_at"
    ).execute()

    print(
        f"Backfill complete: {len(all_climate_rows)} climate_snapshots + "
        f"{len(all_financial_rows)} financial_ledgers rows upserted."
    )


def main() -> None:
    add_time_series_columns()
    backfill()
    print("Synthetic 30-day activity backfill executed successfully.")


if __name__ == "__main__":
    main()
