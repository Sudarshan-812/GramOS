import os

from supabase import Client, create_client

_client: Client | None = None


def get_supabase_client() -> Client:
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. Add them to backend/.env "
            "(see .env.example)."
        )

    _client = create_client(url, key)
    return _client
