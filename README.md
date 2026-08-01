# GramOS

**The AI operating system for rural financial intelligence.**

GramOS is a B2B risk-intelligence platform for rural micro-enterprise lending. It fuses alternative transaction data with satellite-derived climate signals, reasons over both with Gemini in a multi-agent pipeline, and gives loan officers an explainable, auditable NPA (non-performing asset) risk score, weeks before a missed payment would otherwise flag it.

Built for the Google DeepMind "AI for the Planet" Accelerator.

---

## The problem

Legacy credit scoring for rural micro-enterprises (dairy cooperatives, agri-input retailers, handicraft traders) is thin and reactive:

- Static bureau scores, updated quarterly at best
- No visibility into informal, cash-based, or UPI-driven income
- Blind to climate and weather shocks that erode repayment ability
- Risk is only flagged *after* a payment is missed

GramOS fuses structured transaction data with real-time earth observation, reasons over both with an LLM, and surfaces risk **before** it shows up in repayment history, with every score fully explainable and every human override logged for compliance.

## What's built

- **Explainable multi-agent risk engine**: a LangGraph pipeline runs a financial-health agent and a climate-risk agent in parallel over Gemini, combines their output with a separate deterministic scoring model (auditable, not LLM-generated; RBI Model Risk Management-aligned), and synthesizes a final narrative: risk score, classification, financial summary, climate impact, and concrete mitigation steps.
- **Document intelligence**: loan officers upload bank statements, KCC passbooks, or invoices (PDF/image); Gemini's multimodal API extracts underwriting-relevant figures directly from the document into structured JSON, no OCR pipeline required.
- **Human-in-the-loop override with audit trail**: any AI-generated score can be manually overridden by a loan officer with a mandatory justification. The override, the original score, and the officer's identity (from their verified session) are written to an immutable audit log.
- **Proactive risk alerting**: a background scheduler polls every enterprise's latest climate snapshot on an interval and raises a warning the moment NDVI or soil moisture crosses a drought threshold, rather than waiting for someone to check.
- **Multi-view analytics dashboard**: cash flow trend, projected revenue, and a composite risk-profile radar, switchable per enterprise, backed by a real Supabase time series.
- **Authentication & route protection**: Supabase Auth (JWT, verified server-side against Supabase's JWKS) gates both the dashboard and every API route.

## Current status

This is a working prototype, not a production deployment. Three mock enterprises are seeded with real backend logic running end-to-end; AlphaEarth satellite ingestion is stubbed with deterministic synthetic values pending live integration, and financial history is backfilled synthetic data anchored to each enterprise's profile. Everything else (auth, the risk engine, document extraction, the audit trail, and alerting) runs against a real Supabase instance and real Gemini calls.

---

## Architecture

Monorepo with two independently run apps, no shared package layer; the frontend talks to the backend over HTTP.

```
GramOS/
├── frontend/                    # Next.js app (port 3000)
│   ├── app/
│   │   ├── page.tsx              # Marketing landing page
│   │   ├── login/                # Supabase auth login
│   │   └── dashboard/            # Risk dashboard (protected)
│   ├── components/               # RiskChart, DocumentUploader, OverrideScoreModal, Navbar, Footer
│   └── lib/                      # api.ts (backend client), supabase/, types.ts
│
└── backend/                     # FastAPI app (port 8000), Python venv in backend/venv
    ├── main.py                   # Routes + JWT verification + scheduler lifespan
    ├── engine.py                 # LangGraph multi-agent risk pipeline + document extraction
    ├── worker.py                 # Background climate-threshold alert job
    ├── models.py                 # Pydantic v2 schemas
    ├── database.py                # Supabase client
    └── scripts/                   # Schema bootstrap + mock data seeding
```

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Recharts, icons ported from [google/material-design-icons](https://github.com/google/material-design-icons) |
| Backend | FastAPI, Python 3.13, Uvicorn, Pydantic v2 |
| AI / XAI | Gemini 2.5 Flash via the `google-genai` SDK, orchestrated with LangGraph (`langchain-google-genai`) |
| Auth | Supabase Auth, JWT verified server-side against the project's JWKS (asymmetric signing keys) |
| Database | Supabase Postgres via `supabase-py` (REST) for the live app; direct `psycopg2` for one-off schema DDL |
| Scheduling | APScheduler (`AsyncIOScheduler`), run inside the FastAPI lifespan |
| Geospatial | Google AlphaEarth satellite climate data (NDVI, soil moisture, rainfall deviation) |

---

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Python 3.13
- A Supabase project (Postgres + Auth)
- A Gemini API key

### 1. Clone and configure environment variables

```bash
git clone <repo-url> && cd GramOS
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in `backend/.env`:

| Variable | Where to find it |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API (service role key) |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (session pooler, used only for schema DDL) |

Fill in `frontend/.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon/publishable key) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` for local dev |

### 2. Set up the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Create schema + seed the 3 mock enterprises (idempotent, safe to re-run)
python scripts/init_supabase.py
# Backfill 30 days of synthetic time-series activity for those enterprises
python scripts/seed_dynamic_data.py

uvicorn main:app --reload --port 8000
```

A loan officer account is created directly in Supabase Auth (Authentication → Users → Add user); there is no self-serve signup flow.

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`, sign in with the account you created above, and you'll land on the risk dashboard.

---

## API reference

All routes except `GET /` require a Supabase-issued bearer token.

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/mock-profiles` | List seeded enterprise IDs |
| `GET` | `/api/mock-profiles/{id}` | Latest financial + climate profile for an enterprise |
| `GET` | `/api/enterprises/{id}/history` | 30-day revenue/NDVI time series |
| `POST` | `/api/assess-risk` | Run the Gemini risk engine over a profile |
| `POST` | `/api/enterprises/{id}/upload-document` | Upload a financial document for Gemini extraction |
| `GET` | `/api/enterprises/{id}/documents` | List extracted document insights |
| `POST` | `/api/enterprises/{id}/override-score` | Log a human override of an AI-generated score |
| `GET` | `/api/enterprises/{id}/alerts` | List proactive climate risk alerts |

## License

Proprietary, built for the Google DeepMind "AI for the Planet" Accelerator.
