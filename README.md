# VELA Health

> **Know your body. Own your data.**
> Privacy-first · AI-native · Wearable-agnostic health intelligence

VELA is an AI-native health intelligence platform that aggregates biometric data from wearables, CGM patches, and health APIs into a zero-knowledge local vault — then applies Claude to deliver deeply personalized health insights without ever exposing raw personal data to any server.

This repository hosts the **public web showcase** of the VELA product vision. It is a single-page site with an interactive dashboard demo that runs entirely client-side on synthetic data. Nothing is transmitted; nothing is stored.

The mobile app itself (React Native, encrypted vault, BLE, on-device ML) is built and shipped separately — this site is the marketing surface, the privacy story, and a working demo of the user experience.

---

## Live

| Surface | Where |
|---|---|
| GitHub Pages | `https://<your-github-username>.github.io/vela-health/` |
| Cloudflare Pages | `https://vela-health.pages.dev/` |

Both targets serve the same static files from the repo root.

---

## Project layout

Everything is in the repo root — no build step, no bundler, no framework.

```
.
├── index.html          # landing page + interactive dashboard
├── styles.css          # full stylesheet · dark-mode-first
├── app.js              # demo state, charts, "Ask VELA" handler
├── README.md           # this file
├── _headers            # Cloudflare Pages security headers
├── _redirects          # Cloudflare Pages SPA fallback
├── wrangler.toml       # Cloudflare Pages config (optional)
├── .gitignore
└── VELA_Health_PRD_v1.docx   # source product requirements document
```

---

## Local preview

No tooling required. Just open `index.html` in a browser, or serve the folder over HTTP for the cleanest experience:

```bash
# Python 3
python -m http.server 8000

# Node (npx)
npx serve .

# Then visit http://localhost:8000
```

---

## Deploy: Cloudflare Pages (recommended)

### Option A — Git integration (zero-config)

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick this repo. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`
4. Save and deploy. Every push to `main` ships a production build; every PR gets a preview URL.

### Option B — Direct upload via Wrangler

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=vela-health --branch=main
```

The included `wrangler.toml` and `_headers` are picked up automatically.

---

## Deploy: GitHub Pages

1. Push to `main`.
2. **Settings → Pages → Source: Deploy from a branch → `main` / root (`/`)**.
3. The site goes live at `https://<user>.github.io/vela-health/`.

No Jekyll config is needed — Pages serves `index.html` directly.

---

## What the demo does

The dashboard renders fully on-device from a seeded synthetic data generator (`mulberry32` PRNG) so the same biometrics appear every load. The implementation mirrors the PRD:

- **Morning Signal (0–100)** computed from the PRD-specified weights: HRV 30%, RHR 20%, sleep efficiency 20%, glucose CV 20%, skin-temp Δ 10%.
- **Sparklines** for HRV, glucose, sleep, and skin temperature (7-day windows).
- **Glucose × HRV correlation** — 14-day scatter with linear regression and Pearson `r`.
- **"Ask VELA"** — three canned prompts produce grounded answers using real numbers from the live state plus the tool-call shapes from the PRD's Claude tool schema.
- **Detail panel** — tap any tile to see the exact anonymized snapshot Claude would receive: timestamps rounded to the hour, Gaussian DP noise at ε = 0.3, PII fields nulled, ephemeral session token.

### Brand & design tokens

| Token | Hex | Use |
|---|---|---|
| Deep Violet | `#2D1B69` | Primary, headings |
| VELA Teal | `#0FA8A0` | Accent, data, positive trends |
| Signal Coral | `#E84855` | Alerts, anomalies |
| Lavender Light | `#EEF0FF` | Light-mode surfaces |
| Midnight | `#1A1A2E` | Dark surface, primary text |

Typography: Inter for UI, JetBrains Mono for data and timestamps.

---

## Privacy posture (mirrors the product)

This static site:
- makes no XHR / fetch / WebSocket calls,
- ships no analytics or trackers,
- stores nothing in `localStorage` / `sessionStorage`,
- the "waitlist" form is intentionally cosmetic — it never POSTs.

The `_headers` file sets a strict CSP, HSTS, frame-ancestors lockdown, and Permissions-Policy denying camera/mic/geo by default.

---

## Roadmap (from the PRD)

| Phase | Months | Highlights |
|---|---|---|
| **1 — Foundation** | 1–4 | LDV + encryption · WHOOP + Oura adapters · Morning Signal · MVP |
| **2 — Intelligence** | 5–10 | Dexcom + Libre · glucose-HRV correlation · Claude coaching · proactive anomalies |
| **3 — Clinical** | 11–18 | Genomic overlay · FHIR R4 · Apollo pilot · physician dashboard · CDSCO / FDA SaMD scoping |

---

## Document of record

The full Product Requirements Document is committed at `VELA_Health_PRD_v1.docx` and remains the source of truth for product scope, architecture, and regulatory posture.

---

## License & attribution

Confidential & proprietary. v1.0 · May 2026.
**Shibichakravarthy Kannan, MD, PhD** — author and steward of the VELA product.
