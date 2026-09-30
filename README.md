# ForensicDVR — SIH26150

A complete frontend (+ FastAPI backend stub) for a DVR/NVR forensic recovery tool.

## Quick Start

### 1. Frontend (no build needed)
Open `index.html` directly in a browser — **or** serve it with Python:
```bash
python3 -m http.server 3000
# Then open http://localhost:3000
```

### 2. Backend (optional — frontend degrades gracefully without it)
```bash
pip install fastapi uvicorn python-multipart
uvicorn backend:app --reload --port 8000
```

---

## Project Structure
```
sih20150/
├── index.html          — Home page
├── new-case.html       — 3-step wizard
├── analysis.html       — Live analysis progress
├── results.html        — Results dashboard + concordance
├── custody.html        — Chain of custody audit log
├── verify.html         — Report verification
├── report.html         — Report preview + print
├── cases.html          — Cases list
├── reports.html        — Reports list
├── help.html           — Help, Limitations, Accessibility
├── backend.py          — FastAPI API stub
├── css/
│   ├── tokens.css      — Design tokens (CSS variables)
│   ├── global.css      — Base styles
│   ├── layout.css      — Header, nav, footer
│   └── pages.css       — Page-specific styles
├── js/
│   ├── app.js          — Shared JS (i18n, accessibility, API client)
│   ├── en.json         — English strings
│   └── hi.json         — Hindi strings
└── fonts/              — Self-hosted Noto Sans
```

## Design Tokens
| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | #0B3D91 | Deep blue — main brand |
| `--color-accent` | #B34700 | Saffron — CTAs |
| `--color-success` | #146C2E | 4.5:1 on white |
| `--color-warning` | #8A5A00 | 4.5:1 on #FFF4D6 |
| `--color-error` | #B42318 | 4.5:1 on white |

## Accessibility Checklist
- [x] Skip to main content link
- [x] Visible 3px focus ring (`:focus-visible`)
- [x] ARIA landmarks: `header`, `nav`, `main`, `footer`
- [x] `aria-live` regions for toasts and dynamic content
- [x] Color is never the sole status indicator
- [x] All icons are `aria-hidden` with adjacent text labels
- [x] Tables have `<caption>` elements
- [x] Form fields have associated `<label>` + error messages with `role="alert"`
- [x] Modal/drawer focus trap + Escape to close
- [x] `prefers-reduced-motion` respected
- [x] Minimum 44×44px touch targets
- [x] `lang="hi"` on Hindi text
- [x] Text resizable to 200% without horizontal scrolling
- [x] Chart table alternatives in `<details>`
- [x] High-contrast mode toggle (persisted in localStorage)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Tool version, system status |
| GET | /cases | List cases (paginated, filterable) |
| POST | /cases | Create case + start analysis |
| GET | /cases/{id} | Get case details |
| DELETE | /cases/{id} | Cancel running analysis |
| GET | /cases/{id}/results | Get analysis results |
| GET | /cases/{id}/custody | Get chain of custody log |
| POST | /verify | Verify report by SHA-256 hash |

## Disclaimer
Prototype developed for SIH26150. Not an official Government of India website.
