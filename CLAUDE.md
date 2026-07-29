# GramOS

B2B AI-driven cash flow prediction and risk-flagging system for rural micro enterprises, built for the Google DeepMind "AI for the Planet" Accelerator.

## Tech Stack

- **Frontend**: Next.js (App Router, TypeScript, Tailwind CSS), `lucide-react` for icons
  - Note: `npx create-next-app@latest` currently installs Next.js 16 / React 19, not Next.js 14. `frontend/AGENTS.md` warns this version has breaking changes vs. older Next.js conventions — check `frontend/node_modules/next/dist/docs/` before relying on training-data assumptions about App Router APIs.
- **Backend**: FastAPI (Python 3.13), Uvicorn, Pydantic v2
- **AI / XAI**: Gemini API via the `google-genai` SDK (not the deprecated `google-generativeai` package) for explainable risk reasoning, using structured outputs (`response_schema`) to guarantee JSON matching `RiskAssessmentResponse`
- **Geospatial**: Google AlphaEarth satellite climate data
- **Database**: Supabase Postgres, via `backend/database.py` (`supabase-py` REST client for the live app; direct `psycopg2` connections only in `backend/scripts/` for DDL)
- **Config**: `python-dotenv` for backend environment variables

## Architecture

Monorepo with two independently run apps:

```
GramOS/
├── frontend/   # Next.js app (port 3000)
└── backend/    # FastAPI app (port 8000), Python venv in backend/venv
    ├── main.py        # routes: GET /, GET /api/mock-profiles[/{key}], POST /api/assess-risk
    ├── models.py       # Pydantic v2 schemas (FinancialProfile, ClimateProfile, RiskAssessment*)
    ├── engine.py       # LangGraph multi-agent risk analysis + golden fallback cache
    ├── database.py     # Supabase client (get_supabase_client)
    └── scripts/        # one-off DB bootstrap/seed tooling (not imported by the live app)
```

The frontend and backend are decoupled — the frontend calls the backend over HTTP (CORS is enabled for `http://localhost:3000` in `backend/main.py`). There is no shared package/types layer yet.

## Working in this repo

- **Always check both `frontend/` and `backend/` before making a full-stack edit.** A feature (e.g. risk scoring, forecasting) typically needs a FastAPI route/schema change AND a corresponding frontend fetch/UI change — don't ship one half.
- Backend dependencies are pinned in `backend/requirements.txt`. Activate the venv (`backend/venv/Scripts/activate` on Windows) before running `pip install` or `uvicorn`.
- Frontend dependencies are managed via `frontend/package.json` / npm.
- Secrets (e.g. `GEMINI_API_KEY`) go in `backend/.env`, based on `backend/.env.example`. Never commit `.env`.
- Run the backend: `cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000`
- Run the frontend: `cd frontend && npm run dev` (port 3000)
