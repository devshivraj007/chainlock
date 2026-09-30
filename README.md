# DVR/NVR Forensic Recovery Tool

**Prototype built for Smart India Hackathon — Problem Statement SIH26150**  
**Not an official Government of India product.**

A forensic recovery tool for DVR/NVR CCTV storage that prioritizes **legal defensibility** over feature count: every claim in its output — the image hash, the recovery method, the tamper flags, the report itself — is independently re-verifiable by a third party, not just asserted by the tool.

🌐 **Live Demo:** [https://chainlock-forensicdvr.vercel.app](https://chainlock-forensicdvr.vercel.app)

---

## Why this exists

Most DVR/NVR forensic projects focus on recovering the most video, from the most vendors. This one starts from a different question: **can an investigator prove, in court, that the evidence wasn't altered and that the recovery is correct?**

---

## Core guarantees

- **Provable read-only acquisition** — the source disk image is opened `O_RDONLY` only; SHA-256 and file metadata are hashed and logged before and after analysis, so "nothing was written" is verifiable, not claimed.
- **Dual-method recovery with concordance** — index-based parsing and independent signature carving run separately; the report shows where they agree and where they don't, giving a built-in error check.
- **Tamper detection** — flags frame timestamps that fall outside the logged recording window or that disagree with the on-disk index, surfacing clock tampering.
- **Hash-chained audit log** — every action (acquisition, parsing, checks, report generation) is recorded in an append-only, hash-chained log; altering any entry breaks the chain visibly.
- **Deterministic, signed reports** — re-running the analysis on the same image produces an identical report hash; reports can be signed (Ed25519) by the examiner and independently verified.
- **Standalone verifier** — a separate tool re-hashes the image, re-checks the audit chain, and re-runs the analysis to confirm the report wasn't altered after the fact.
- **Plugin architecture** — adding a vendor is a config/module addition, not a rewrite.

---

## AI-assisted features (clearly separated from verified findings)

- Burned-in timestamp OCR vs. on-disk metadata comparison
- Automatic activity/event detection across channels
- Log/timestamp anomaly detection
- A local, offline investigator assistant (via [Ollama](https://ollama.com)) that answers questions grounded only in that case's own report — **no case data ever leaves the machine**

> All AI output is advisory, confidence-scored, and requires explicit examiner sign-off before it can appear in a certificate. It never modifies the deterministic `concordance` or `tamper_flags` results.

---

## Stack

| Layer | Technology |
|-------|------------|
| Core engine | Python |
| Backend API | FastAPI (serverless via Vercel) |
| Frontend | HTML + CSS + JS (GIGW/WCAG 2.1 AA–aligned) |
| i18n | English & Hindi (self-hosted Noto Sans) |
| Local LLM | Ollama (optional, fully offline) |
| Deployment | Vercel |

> No external network calls. No telemetry.

---

## Quick Start

### 1. Frontend (no build needed)
Open `index.html` directly in a browser **or** serve it locally:
```bash
python3 -m http.server 3000
# Then open http://localhost:3000
```

### 2. Backend (optional — frontend degrades gracefully without it)
```bash
pip install fastapi uvicorn python-multipart pydantic
uvicorn backend:app --reload --port 8000
```

---

## Project Structure

```
sih20150/
├── index.html          — Home / dashboard
├── new-case.html       — 3-step case wizard
├── analysis.html       — Live analysis progress
├── results.html        — Results dashboard + concordance chart
├── custody.html        — Hash-chained chain of custody log
├── verify.html         — Report verification (SHA-256 + signature)
├── report.html         — Report preview + print / export
├── cases.html          — Cases list (paginated, filterable)
├── reports.html        — Reports list
├── help.html           — Help, Limitations, Accessibility
├── backend.py          — FastAPI API (in-memory prototype)
├── api/
│   └── index.py        — Vercel serverless entry point
├── requirements.txt    — Python dependencies
├── vercel.json         — Vercel deployment config
├── css/
│   ├── tokens.css      — Design tokens (CSS variables)
│   ├── global.css      — Base styles
│   └── layout.css      — Header, nav, footer
├── js/
│   ├── app.js          — Shared JS (i18n, accessibility, API client)
│   ├── en.json         — English strings
│   └── hi.json         — Hindi strings
└── fonts/              — Self-hosted Noto Sans
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Tool version, system status |
| `GET` | `/cases` | List cases (paginated, filterable) |
| `POST` | `/cases` | Create case + start analysis |
| `GET` | `/cases/{id}` | Get case details |
| `DELETE` | `/cases/{id}` | Cancel running analysis |
| `GET` | `/cases/{id}/results` | Get analysis results |
| `GET` | `/cases/{id}/custody` | Get chain of custody log |
| `POST` | `/verify` | Verify report by SHA-256 hash |

---

## Design Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#0B3D91` | Deep blue — main brand |
| `--color-accent` | `#B34700` | Saffron — CTAs |
| `--color-success` | `#146C2E` | 4.5:1 contrast on white |
| `--color-warning` | `#8A5A00` | 4.5:1 contrast on `#FFF4D6` |
| `--color-error` | `#B42318` | 4.5:1 contrast on white |

---

## Accessibility (WCAG 2.1 AA)

- [x] Skip-to-main-content link
- [x] Visible 3px focus ring (`:focus-visible`)
- [x] ARIA landmarks: `header`, `nav`, `main`, `footer`
- [x] `aria-live` regions for toasts and dynamic content
- [x] Color is never the sole status indicator
- [x] All icons are `aria-hidden` with adjacent text labels
- [x] Tables have `<caption>` elements
- [x] Form fields have associated `<label>` + error messages with `role="alert"`
- [x] Modal/drawer focus trap + Escape to close
- [x] `prefers-reduced-motion` respected
- [x] Minimum 44×44 px touch targets
- [x] `lang="hi"` on Hindi text
- [x] Text resizable to 200% without horizontal scrolling
- [x] Chart table alternatives in `<details>`
- [x] High-contrast mode toggle (persisted in `localStorage`)

---

## Honest Limitations

- Vendor layouts are currently **simplified/synthetic**, built from published research, not reverse-engineered from real recorders. This is labeled everywhere in the tool's output.
- Every dataset used is tagged `SYNTHETIC`, `PUBLIC-EXPORT`, or `REAL-DISK` — synthetic results are never reported as real-world accuracy.
- This is a prototype: no formal security audit or penetration test has been performed. See `SECURITY.md` and `LIMITATIONS.md`.
- Read-only acquisition here is a software safeguard; production use should pair it with a hardware write-blocker.
- In-memory data store — data resets on server restart. Production use requires a persistent database.

---

## Supported Vendors (Prototype)

| Vendor | Status |
|--------|--------|
| Hikvision | Synthetic layout |
| Dahua | Synthetic layout |
| CP Plus | Synthetic layout |
| Axis | Synthetic layout |
| Hanwha | Synthetic layout |
| Bosch | Synthetic layout |

---

## Disclaimer

Prototype developed for **SIH26150**. Not an official Government of India website or product. All recovery statistics shown are from synthetic datasets and must not be cited as real-world benchmarks.
