# GramOS

**A research prototype testing whether sugar-mill payment data predicts rural credit risk.**

GramOS is a B2B risk-intelligence platform for rural micro-enterprise lending. It fuses alternative transaction data with real government ground-observation and satellite-derived climate signals, reasons over all of it with Gemini in a multi-agent pipeline, and gives loan officers an explainable, auditable NPA (non-performing asset) risk score, weeks before a missed payment would otherwise flag it.

An independent research project, not a commercial product.

---

## The problem

Legacy credit scoring for rural micro-enterprises (dairy cooperatives, agri-input retailers, handicraft traders) is thin and reactive:

- Static bureau scores, updated quarterly at best
- No visibility into informal, cash-based, or UPI-driven income
- Blind to climate and weather shocks that erode repayment ability
- Blind to buyer-side shocks — when the mill or cooperative that owes the grower delays payment, every grower in that catchment is hit at once
- Risk is only flagged *after* a payment is missed

GramOS fuses structured transaction data with real-time earth observation and real buyer-payment data, reasons over all of it with an LLM, and surfaces risk **before** it shows up in repayment history, with every score fully explainable and every human override logged for compliance.

## What's built

- **Explainable multi-agent risk engine**: a LangGraph pipeline fans out four analysis agents in parallel over Gemini — financial health, satellite climate (synthetic NDVI / soil moisture, see "Current status"), India-WRIS ground observation, and buyer-payment (mill arrears) — then combines their output with a separate deterministic scoring model (auditable, not LLM-generated; RBI Model Risk Management-aligned) and synthesizes a final narrative: risk score, classification, financial summary, climate impact, buyer-payment impact, ground-observation note, and concrete mitigation steps. The auditable pipeline copies the deterministic score verbatim — the LLM only writes prose.
- **Real buyer-payment risk signal**: rather than a synthetic proxy, `buyer_payment_risk` is sourced from a real Karnataka RTI response on sugar mill cane-crushing/payment arrears. The hypothesis under test: when a mill delays the statutory 14-day payment to growers, it hits every grower village in that catchment at once, a shock invisible to both financial ledgers and satellite crop-health monitoring, since the crop itself is fine and the buyer just has not paid. As "Current status" below shows, the 2025-26 season data mostly rejects this hypothesis, arrears were negligible, but reconciling the same RTI dataset against statutory cane pricing surfaced a different, real income gap (see the primary finding below). See `backend/rti_data.py` and `backend/scripts/parse_rti_cane_arrears.py`.
- **Primary finding, the real income gap under headline cane rates**: reconciling the same RTI dataset (53 mills, 2025-26 season, Belagavi / Bagalkote / Vijayapura, officially 99.4% of dues paid) against the statutory Fair and Remunerative Price (FRP: Rs 355 per quintal at 10.25% recovery, adjusted Rs 3.46 per 0.1 percentage point of recovery) shows every one of the 53 mills pays below FRP once the average Rs 906 per tonne harvesting-and-transport deduction is applied. The shortfall totals Rs 3,183 Cr across the three districts, inside a dataset officially reported as fully paid. A lender sizing repayment capacity from headline cane rates overestimates farm household income by roughly 20%. On the mills' own harvesting-and-transport-inclusive accounting, only 4 of 53 fall short of FRP; this project uses the farmer-received basis, since that is the cash that actually reaches the household.
- **Real ground-observation climate signal (India-WRIS)**: district-level rainfall (rain-gauge readings) and groundwater borewell depth are pulled from India-WRIS (`indiawris.gov.in`) government monitoring stations — real measurements, no API key. They feed both a dedicated LLM agent and a deterministic term in the score (groundwater depth ≤ −20 m → severe, ≤ −10 m → moderate). A declining water table is a leading indicator of irrigation and drinking-water stress even in a year with normal rainfall. See `backend/wris_client.py` and `backend/scripts/fetch_wris_climate_data.py`.
- **Document intelligence**: loan officers upload bank statements, KCC passbooks, or invoices (PDF/image); Gemini's multimodal API extracts underwriting-relevant figures directly from the document into structured JSON, no OCR pipeline required.
- **Human-in-the-loop override with audit trail**: any AI-generated score can be manually overridden by a loan officer with a mandatory justification. The override, the original score, and the officer's identity (from their verified session) are written to an immutable audit log.
- **Proactive risk alerting**: a background scheduler polls every enterprise's latest climate snapshot on an interval and raises a warning the moment NDVI or soil moisture crosses a drought threshold, rather than waiting for someone to check.
- **Multi-view analytics dashboard**: cash flow trend, projected revenue, and a composite risk-profile radar, switchable per enterprise, backed by a real Supabase time series.
- **Authentication & route protection**: Supabase Auth (JWT, verified server-side against Supabase's JWKS) gates both the dashboard and every API route.

## Current status

This is a working prototype, not a production deployment. 21 enterprises are seeded — one per taluk covered by a Karnataka RTI response on 2025-26 season cane crushing/payment arrears (registration `SECCI/R/2026/60049`, received 2026-08-23) — with real backend logic running end-to-end.

**Two of the model's inputs are real data, not placeholders:**

- `buyer_payment_risk` — mill name, weighted arrears exposure, and stress flag per taluk, from the RTI response above (`backend/rti_data.py`, `backend/scripts/parse_rti_cane_arrears.py`).
- `wris_climate` — district rainfall and groundwater borewell depth from India-WRIS government monitoring stations (`backend/wris_client.py`, `backend/scripts/fetch_wris_climate_data.py`).

Financials and the NDVI / soil-moisture climate profile are still synthetic (seeded deterministically per taluk, scaled to that taluk's real stress level) pending a real per-enterprise ledger and a real satellite-climate integration, which was scoped but never built. Auth, the risk engine, document extraction, the audit trail, and alerting all run against a real Supabase instance and real Gemini calls.

**Known limitation, stated plainly**: the RTI data is a single season-end snapshot (99.4% of arrears were already paid by the time it arrived). A signal-contribution ablation study ([`BACKTEST.md`](BACKTEST.md)) confirms the buyer-payment signal is plumbed correctly end-to-end, bounded and monotonic, tracks real rupee arrears (Spearman ρ = 0.88 against the final score), and flips the risk band for 7 of 21 enterprises — all upward, all in real-arrears taluks, zero spurious moves in zero-arrears taluks. But that is **not** a predictive validation: it cannot show the signal *forecasts* borrower repayment stress 60–120 days out, or that it adds lift over a bureau score — the synthetic features here were seeded to co-vary with RTI stress. That needs backtesting against real, anonymized loan-repayment data from a lending partner, which has not happened yet.

---

## Architecture

Monorepo with two independently run apps, no shared package layer; the frontend talks to the backend over HTTP.

```
GramOS/
├── BACKTEST.md                  # RTI buyer-payment signal ablation study
│
├── frontend/                    # Next.js app (port 3000)
│   ├── app/
│   │   ├── page.tsx              # Marketing landing page
│   │   ├── login/                # Supabase auth login
│   │   └── dashboard/            # Risk dashboard (protected)
│   ├── components/               # RiskChart, DocumentUploader, OverrideScoreModal, Navbar, Footer
│   └── lib/                      # api.ts (backend client), supabase/, types.ts
│
└── backend/                     # FastAPI app (port 8000)
    ├── main.py                   # Routes + JWT verification + scheduler lifespan + WRIS snapshot load
    ├── engine.py                 # LangGraph multi-agent risk pipeline + document extraction
    ├── worker.py                 # Background climate-threshold alert job
    ├── models.py                 # Pydantic v2 schemas
    ├── database.py               # Supabase client
    ├── rti_data.py               # Parsed RTI cane-arrears exposure, per taluk
    ├── wris_client.py            # India-WRIS rainfall / groundwater API client
    └── scripts/                  # Schema bootstrap, data seeding, RTI + WRIS ingestion, backtest
```

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Recharts, icons ported from [google/material-design-icons](https://github.com/google/material-design-icons) |
| Backend | FastAPI, Python 3.13, Uvicorn, Pydantic v2 |
| AI / XAI | Gemini (`gemini-3.1-flash-lite`) via the `google-genai` SDK, orchestrated with LangGraph (`langchain-google-genai`) |
| Auth | Supabase Auth, JWT verified server-side against the project's JWKS (asymmetric signing keys) |
| Database | Supabase Postgres via `supabase-py` (REST) for the live app; direct `psycopg2` for one-off schema DDL |
| Scheduling | APScheduler (`AsyncIOScheduler`), run inside the FastAPI lifespan |
| Ground observation | India-WRIS government monitoring stations — rainfall, groundwater depth (real, `indiawris.gov.in`, no key) |
| Satellite climate | NDVI, soil moisture, rainfall deviation. Synthetic placeholder, scoped but never built. |

---

## API reference

All routes except `GET /` require a Supabase-issued bearer token.

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/mock-profiles` | List seeded enterprise IDs |
| `GET` | `/api/mock-profiles/{id}` | Latest financial + climate profile for an enterprise |
| `GET` | `/api/enterprises/{id}/history` | 30-day revenue/NDVI time series |
| `POST` | `/api/assess-risk` | Run the multi-agent risk engine over a profile — returns score, classification, financial / climate / buyer-payment / ground-observation narratives, and mitigation steps |
| `POST` | `/api/enterprises/{id}/upload-document` | Upload a financial document for Gemini extraction |
| `GET` | `/api/enterprises/{id}/documents` | List extracted document insights |
| `POST` | `/api/enterprises/{id}/override-score` | Log a human override of an AI-generated score |
| `GET` | `/api/enterprises/{id}/alerts` | List proactive climate risk alerts |

## License

Proprietary. Not open source; the source is not licensed for redistribution or third-party use.
