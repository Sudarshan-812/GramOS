"""One-off Supabase Postgres bootstrap for GramOS.

Creates the enterprises / financial_ledgers / climate_snapshots tables via a direct
Postgres connection (SUPABASE_DB_URL), then seeds the 3 core mock enterprises via the
Supabase REST client (SUPABASE_URL / SUPABASE_SERVICE_KEY).

The Supabase REST client (postgrest-based) cannot execute DDL such as CREATE TABLE,
so schema creation and data seeding deliberately use two different connections.

Run with: python backend/scripts/init_supabase.py
"""

import os
import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

import psycopg2

from database import get_supabase_client
from seed_profiles import MOCK_PROFILES

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS enterprises (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_ledgers (
    id UUID PRIMARY KEY,
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    monthly_revenue_inr FLOAT NOT NULL,
    upi_transaction_count INT NOT NULL,
    avg_ticket_size_inr FLOAT NOT NULL,
    days_past_due INT NOT NULL,
    kcc_limit_utilized_pct FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS climate_snapshots (
    id UUID PRIMARY KEY,
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    ndvi_index FLOAT NOT NULL,
    soil_moisture_percentage FLOAT NOT NULL,
    rainfall_deviation_pct FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_insights (
    id UUID PRIMARY KEY,
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    extracted_json JSONB NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL,
    original_score INT NOT NULL,
    overridden_score INT NOT NULL,
    justification TEXT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT now()
);
"""


def create_schema() -> None:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to backend/.env (see .env.example) — this is "
            "the direct Postgres connection string from Project Settings -> Database -> "
            "Connection string, required because the Supabase REST client cannot run DDL."
        )

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(SCHEMA_SQL)
        print(
            "Schema ready: enterprises, financial_ledgers, climate_snapshots, "
            "document_insights, audit_logs"
        )
    finally:
        conn.close()


def seed_mock_enterprises() -> None:
    client = get_supabase_client()

    for factory in MOCK_PROFILES.values():
        profile = factory()

        existing = (
            client.table("enterprises")
            .select("id")
            .eq("name", profile.enterprise_name)
            .execute()
        )
        if existing.data:
            print(f"Skipping already-seeded enterprise: {profile.enterprise_name}")
            continue

        enterprise_id = str(uuid.uuid4())
        client.table("enterprises").insert(
            {
                "id": enterprise_id,
                "name": profile.enterprise_name,
                "business_type": profile.financials.business_type,
            }
        ).execute()

        client.table("financial_ledgers").insert(
            {
                "id": str(uuid.uuid4()),
                "enterprise_id": enterprise_id,
                "monthly_revenue_inr": profile.financials.monthly_revenue_inr,
                "upi_transaction_count": profile.financials.upi_transaction_count,
                "avg_ticket_size_inr": profile.financials.avg_ticket_size_inr,
                "days_past_due": profile.financials.days_past_due,
                "kcc_limit_utilized_pct": profile.financials.kcc_utilization_pct,
            }
        ).execute()

        client.table("climate_snapshots").insert(
            {
                "id": str(uuid.uuid4()),
                "enterprise_id": enterprise_id,
                "ndvi_index": profile.climate.ndvi_index,
                "soil_moisture_percentage": profile.climate.soil_moisture_percentage,
                "rainfall_deviation_pct": profile.climate.rainfall_deviation_pct,
            }
        ).execute()

        print(f"Seeded enterprise: {profile.enterprise_name}")

    print("Seed complete: dairy co-op, agri-retailer, and handloom trader are in Supabase.")


def main() -> None:
    create_schema()
    seed_mock_enterprises()
    print("Supabase connection verified — schema created and seeded successfully.")


if __name__ == "__main__":
    main()
