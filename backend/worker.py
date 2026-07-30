"""Background worker: proactive climate risk alerting.

check_climate_thresholds() is scheduled by main.py's AsyncIOScheduler to run on an
interval. It scans every enterprise's latest climate snapshot and writes an `alerts`
row when NDVI or soil moisture has dropped into drought territory, deduplicated so a
given enterprise gets at most one unread CLIMATE_WARNING per calendar day.
"""

import logging
import uuid
from datetime import datetime, timezone

from database import get_supabase_client

logger = logging.getLogger("gramos.worker")

NDVI_THRESHOLD = 0.30
SOIL_MOISTURE_THRESHOLD_PCT = 20.0
CLIMATE_WARNING_ALERT_TYPE = "CLIMATE_WARNING"


async def check_climate_thresholds() -> None:
    client = get_supabase_client()

    enterprises = client.table("enterprises").select("id, name").execute().data
    today_start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
    )

    for enterprise in enterprises:
        enterprise_id = enterprise["id"]

        latest = (
            client.table("climate_snapshots")
            .select("ndvi_index, soil_moisture_percentage")
            .eq("enterprise_id", enterprise_id)
            .order("recorded_at", desc=True, nullsfirst=False)
            .limit(1)
            .execute()
            .data
        )
        if not latest:
            continue
        snapshot = latest[0]
        ndvi = snapshot["ndvi_index"]
        soil_moisture = snapshot["soil_moisture_percentage"]

        breaches = []
        if ndvi < NDVI_THRESHOLD:
            breaches.append(f"NDVI has dropped to {ndvi:.2f} (below {NDVI_THRESHOLD})")
        if soil_moisture < SOIL_MOISTURE_THRESHOLD_PCT:
            breaches.append(
                f"soil moisture has dropped to {soil_moisture:.1f}% "
                f"(below {SOIL_MOISTURE_THRESHOLD_PCT:.0f}%)"
            )
        if not breaches:
            continue

        existing = (
            client.table("alerts")
            .select("id")
            .eq("enterprise_id", enterprise_id)
            .eq("alert_type", CLIMATE_WARNING_ALERT_TYPE)
            .eq("is_read", False)
            .gte("created_at", today_start)
            .execute()
            .data
        )
        if existing:
            continue

        message = f"Climate risk warning for {enterprise['name']}: " + "; ".join(breaches) + "."
        client.table("alerts").insert(
            {
                "id": str(uuid.uuid4()),
                "enterprise_id": enterprise_id,
                "alert_type": CLIMATE_WARNING_ALERT_TYPE,
                "message": message,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
        logger.info(
            "Created CLIMATE_WARNING alert for '%s' (%s)", enterprise["name"], enterprise_id
        )
