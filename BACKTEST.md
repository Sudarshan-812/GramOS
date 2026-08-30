# GramOS — RTI Buyer-Payment Signal Backtest

**Date:** 2026-08-30
**Signal under test:** `buyer_payment` — per-taluk sugar-mill cane-payment arrears, sourced
from Karnataka RTI response `SECCI/R/2026/60049` (2025-26 season), covering 21 taluks
across Belagavi / Bagalkote / Vijayapura.
**Scripts:** `backend/scripts/backtest_rti_signal.py` (deterministic ablation, all 21) +
a full-engine HTTP spot-check on 7 enterprises.
**Raw output:** `backend/scripts/backtest_rti_signal_result.json`

---

## ⚠️ What this backtest is — and is not

**It is NOT a predictive validation.** No borrower loan-repayment outcomes exist yet, so
this cannot measure whether the buyer-payment signal predicts NPAs, defaults, or 30+ DPD
events. The core product hypothesis — *a mill payment delay shows up as borrower repayment
stress 60–120 days later* — is **untested** and can only be tested against a lending
partner's anonymized repayment history (see [What a real backtest needs](#what-a-real-backtest-needs)).

**It IS a signal-contribution / ablation study.** Every RTI-backed demo enterprise is
scored through the deterministic risk model twice — once **with** the real RTI
`buyer_payment` signal, once **with it removed** — every other input held identical. This
establishes that the signal:

1. is wired correctly end-to-end (`rti_data.py` → request → deterministic model → final
   score → LLM narrative);
2. moves the score in the right direction, by a bounded amount;
3. fires **only** where real arrears exist;
4. tracks real rupee arrears exposure monotonically.

### Second caveat — feature contamination

The non-RTI inputs (financials, climate) for these 21 demo enterprises are **synthetic**,
and were seeded per-taluk *scaled to that taluk's real RTI stress level*. The "without
RTI" score is therefore **not independent** of RTI stress. This backtest consequently
**cannot** demonstrate that the buyer-payment signal is *orthogonal* to conventional
credit signals — which is the headline product claim. Any separation / AUC-type number
computed on this data is inflated by the seeding and is not reported here.

---

## Dataset

| Stress flag | Taluks | Weighted arrears exposure (₹ cr) | Mills |
|---|---|---|---|
| HIGH   | 4  | 17.56 – 26.28 | 3–4 each |
| MEDIUM | 5  | 1.50 – 4.33   | 1–3 each |
| LOW    | 12 | 0.00 (no arrears) | 1–3 each |

21 taluks total. The RTI source carries near-duplicate taluk labels
("Bagalkote"/"Bagalkot", "Bailahongal"/"Bailahongala"); these are passed through
unchanged.

---

## Method

- **Model under test:** `engine.calculate_base_score` — the deterministic, auditable
  scorer. The LangGraph LLM agents only write the narrative; they copy this score
  verbatim (enforced in `engine.synthesize_risk`).
- **Score → band:** `risk_score = 100 − health`; LOW 0–24 / MEDIUM 25–49 / HIGH 50–74 /
  CRITICAL 75–100.
- **RTI term in the model:** `stress_flag == HIGH` → −20 health; `MEDIUM` → −10;
  `LOW` → 0. (Provisional deductions, not fitted to any loan book.)
- **Ablation:** `score_with_rti` (buyer_payment supplied) vs `score_without_rti`
  (buyer_payment = `None`). Financials, climate, and the real India-WRIS groundwater
  term are identical across both.
- **Full-engine spot-check:** 7 enterprises run through `POST /api/assess-risk` (real
  Gemini pipeline) to confirm real (non-fallback) assessments and that the LLM pipeline
  reproduces the deterministic score exactly.

---

## Results — deterministic ablation (all 21 enterprises)

`off` = score without RTI signal, `on` = score with it, `Δ` = contribution of the signal.

| Taluk | District | ₹cr | Flag | DPD | KCC% | Rain% | GW m | off | on | Δ | Band shift |
|---|---|--:|:--|--:|--:|--:|--:|--:|--:|--:|:--|
| Jamkhandi   | Bagalkote  | 26.28 | HIGH   | 22 | 78.2 | −10.7 | −7.0  | 49 | 69 | +20 | MEDIUM → **HIGH** |
| Athani      | Belagavi   | 19.83 | HIGH   | 18 | 70.4 | −13.0 | −9.2  | 43 | 63 | +20 | MEDIUM → **HIGH** |
| Mudhol      | Bagalkote  | 17.82 | HIGH   | 27 | 85.2 | −5.5  | −7.0  | 67 | 87 | +20 | HIGH → **CRITICAL** |
| Indi        | Vijayapura | 17.56 | HIGH   | 28 | 77.1 | −6.8  | −13.5 | 66 | 86 | +20 | HIGH → **CRITICAL** |
| Bagalkote   | Bagalkote  | 4.33  | MEDIUM | 5  | 68.3 | −5.3  | −7.0  | 13 | 23 | +10 | LOW → LOW |
| Bilagi      | Bagalkote  | 3.85  | MEDIUM | 10 | 44.9 | −4.3  | −7.0  | 22 | 32 | +10 | LOW → **MEDIUM** |
| Badami      | Bagalkote  | 3.71  | MEDIUM | 10 | 57.7 | −2.7  | −7.0  | 21 | 31 | +10 | LOW → **MEDIUM** |
| Savadatti   | Belagavi   | 3.04  | MEDIUM | 12 | 48.1 | −0.9  | −9.2  | 24 | 34 | +10 | LOW → **MEDIUM** |
| Bailahongal | Belagavi   | 1.50  | MEDIUM | 7  | 54.7 | 3.0   | −9.2  | 14 | 24 | +10 | LOW → LOW |
| Almel       | Vijayapura | 0.00  | LOW    | 1  | 27.8 | 4.2   | −13.5 | 9  | 9  | 0   | LOW → LOW |
| Bagalkot    | Bagalkote  | 0.00  | LOW    | 1  | 32.5 | 2.4   | −7.0  | 2  | 2  | 0   | LOW → LOW |
| Bailahongala| Belagavi   | 0.00  | LOW    | 3  | 28.1 | 3.7   | −9.2  | 6  | 6  | 0   | LOW → LOW |
| Belagavi    | Belagavi   | 0.00  | LOW    | 1  | 34.1 | 3.8   | −9.2  | 2  | 2  | 0   | LOW → LOW |
| Chikkodi    | Belagavi   | 0.00  | LOW    | 3  | 43.1 | 1.8   | −9.2  | 6  | 6  | 0   | LOW → LOW |
| Gokak       | Belagavi   | 0.00  | LOW    | 2  | 42.9 | 0.3   | −9.2  | 4  | 4  | 0   | LOW → LOW |
| Hukkeri     | Belagavi   | 0.00  | LOW    | 2  | 39.6 | −3.6  | −9.2  | 6  | 6  | 0   | LOW → LOW |
| Khanapur    | Belagavi   | 0.00  | LOW    | 2  | 31.7 | 2.5   | −9.2  | 4  | 4  | 0   | LOW → LOW |
| Nippani     | Belagavi   | 0.00  | LOW    | 2  | 37.4 | −0.9  | −9.2  | 4  | 4  | 0   | LOW → LOW |
| Raibag      | Belagavi   | 0.00  | LOW    | 2  | 43.4 | −2.6  | −9.2  | 5  | 5  | 0   | LOW → LOW |
| Ramdurg     | Belagavi   | 0.00  | LOW    | 4  | 32.2 | −1.3  | −9.2  | 9  | 9  | 0   | LOW → LOW |
| Sindagi     | Vijayapura | 0.00  | LOW    | 0  | 43.6 | 5.7   | −13.5 | 7  | 7  | 0   | LOW → LOW |

### Aggregates

| Metric | Value |
|---|---|
| Enterprises scored | 21 |
| Risk-band changes caused by the RTI signal | **7 / 21** |
| …of which move upward (riskier) | **7 / 7** |
| …of which are in a real-arrears (HIGH/MEDIUM) taluk | **7 / 7** |
| Spurious changes in a zero-arrears taluk | 0 |
| Mean Δ — HIGH cohort | **+20.0** |
| Mean Δ — MEDIUM cohort | **+10.0** |
| Mean Δ — LOW cohort | 0.0 |
| Mean score, HIGH cohort: without → with | 56.2 → **76.2** |
| Mean score, MEDIUM cohort: without → with | 18.8 → **28.8** |
| Mean score, LOW cohort: without → with | 5.3 → 5.3 |
| Spearman ρ (arrears ₹cr vs final score) | **0.875** |

---

## Results — full-engine spot-check (7 enterprises, real Gemini pipeline)

| Taluk | Flag | ₹cr | HTTP | Time | Score | Class | Fallback? | Matches deterministic? |
|---|:--|--:|--:|--:|--:|:--|:--|:--|
| Jamkhandi | HIGH   | 26.28 | 200 | 20.6s | 69 | HIGH     | no | ✅ 69 |
| Athani    | HIGH   | 19.83 | 200 | 20.2s | 63 | HIGH     | no | ✅ 63 |
| Mudhol    | HIGH   | 17.82 | 200 | 16.8s | 87 | CRITICAL | no | ✅ 87 |
| Indi      | HIGH   | 17.56 | 200 | 12.1s | 86 | CRITICAL | no | ✅ 86 |
| Bagalkote | MEDIUM | 4.33  | 200 | 19.8s | 23 | LOW      | no | ✅ 23 |
| Chikkodi  | LOW    | 0.00  | 200 | 16.0s | 6  | LOW      | no | ✅ 6  |
| Sindagi   | LOW    | 0.00  | 200 | 18.4s | 7  | LOW      | no | ✅ 7  |

All 7 returned live assessments (no golden-fallback), and the LLM pipeline reproduced the
deterministic score exactly in every case. End-to-end latency 12–21s (see the timeout
note in `backend/main.py`).

### Narrative excerpts (`buyer_payment_risk_impact`)

**Jamkhandi (HIGH, ₹26.3cr) — score 69:**
> "The high arrears exposure of Rs 26.3 crore in the Jamkhandi taluk creates a systemic
> liquidity trap that threatens the cooperative's future cash flow, regardless of its
> current repayment performance. […] members, deprived of expected harvest proceeds, are
> forced to prioritize subsistence or debt servicing over cooperative dues."
> — top mitigation: *"Restructure existing KCC credit lines to align repayment schedules
> with the delayed mill payment cycles."*

**Chikkodi (LOW, ₹0cr) — score 6:**
> "While the current zero-arrears status suggests a stable liquidity environment, the
> enterprise remains structurally vulnerable to 'systemic payment synchronization' risk
> […] any sudden deterioration in the mill's financial health […] would simultaneously
> freeze the cash inflows of the entire grower base."

*Observation:* the narrative model leans on a recurring template ("systemic liquidity
trap", "contagion of insolvency") across enterprises. Fine for a demo; worth prompt-tuning
for variety before customer-facing use.

---

## Interpretation

### What the results support

- **The signal is real and correctly plumbed.** It flows from the parsed RTI dataset to
  the final score and into the LLM narrative, and the auditable LLM pipeline never
  deviates from the deterministic score.
- **Its effect is bounded and well-behaved:** exactly −20 / −10 / 0 health by stress
  flag, monotonic, and it fires **only** in taluks with real arrears. Zero false moves in
  the 12 zero-arrears taluks.
- **It is decisive at the margin:** 1 in 3 enterprises (7/21) crosses a risk band purely
  because of it — including two moving into CRITICAL and three from LOW into MEDIUM.
- **It ranks with real money:** higher weighted rupee arrears → higher risk score
  (ρ = 0.88 across all 21).

### What the results do NOT support (and cannot, with this data)

- That the signal **predicts** borrower repayment stress at any horizon.
- That it adds **lift over a bureau score** or conventional features on a real loan book —
  the synthetic features here were seeded to co-vary with RTI stress, so ρ = 0.875 with
  *and* without the signal.
- Any **calibration** of the −20 / −10 deductions. They are placeholders.
- Generalisation beyond 21 taluks in 3 districts for one season (99.4% of which was
  already paid by the time the RTI response arrived).

---

## What a real backtest needs

From a lending partner, anonymized and account-level:

1. **Monthly repayment status** (DPD buckets) for borrowers in these taluks / mill
   catchments, **2023-01 → 2026-06**.
2. **Loan metadata:** origination date, product, sanctioned amount, borrower taluk/village.
3. **The lender's own risk score at origination** — the baseline the signal must beat.

Then: align each borrower to its taluk's mill-arrears timeline, define the event (e.g.
*30+ DPD within 120 days of a mill-arrears spike*), and measure **AUC / KS / lift** of the
buyer-payment signal alone and stacked on the baseline.
**Success threshold to propose:** ≥ 0.05 AUC improvement over the baseline.

Data request spec: `Ref_data/Pilot_Backtest_Data_Request.md`.
Data-sharing agreement draft: `Ref_data/Pilot_Data_Sharing_Agreement_Draft.md`.

---

## Reproduce

```bash
# deterministic ablation, all 21 enterprises (fast, needs Supabase + backend/.env)
backend/venv/Scripts/python.exe backend/scripts/backtest_rti_signal.py
# -> prints summary, writes backend/scripts/backtest_rti_signal_result.json
```

The full-engine spot-check hits `POST /api/assess-risk` for 7 enterprises via FastAPI's
`TestClient` with `verify_jwt` overridden, and needs a working `GEMINI_API_KEY`.
