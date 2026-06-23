# CyberSentinel AI — Complete Project Guide

## What Is This?

CyberSentinel AI is an **autonomous security intelligence platform** built as a year-end student project. It combines:

- **Generative AI** (Groq/Llama) for security analysis
- **Real network scanning** (Nmap integration)
- **Live CVE feeds** (NVD API)
- **Attack simulation** (Red Team vs Blue Team)
- **Multi-tool report fusion** (Nmap + Nikto + WiFi)
- **Automated PDF playbook generation**

## Who Is This For?

Two students:
- **You** — Software Engineering background, beginner in cybersecurity
- **Your friend** — Cybersecurity background, beginner in programming

Both beginners. This guide explains everything step by step.

## How to Use This Guide

1. Follow phases in order (Phase 0 → Phase 6)
2. Each phase has numbered steps
3. Copy code exactly as shown
4. Run verification after each phase
5. Don't skip phases — each builds on the previous

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  BROWSER (React.js + Tailwind CSS)                   │
│  ┌─────────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌─────┐ │
│  │Dashboard│ │ Chat │ │Scanner │ │Reports │ │ Sim │ │
│  └────┬────┘ └──┬───┘ └───┬────┘ └───┬────┘ └──┬──┘ │
│       └─────────┴─────────┴──────────┴─────────┘    │
│                      │ HTTP /api/*                   │
└──────────────────────┼───────────────────────────────┘
                       │  (Vite proxy in dev)
┌──────────────────────┼───────────────────────────────┐
│  BACKEND (FastAPI)   │  Port 8000                     │
│  ┌───────────────────▼──────────────────────────┐   │
│  │  app.py — Routes + AI orchestration          │   │
│  ├──────────┬──────────┬──────────┬─────────────┤   │
│  │ scanner  │ cve_feed │ pdf_gen  │   auth      │   │
│  │  .py     │  .py     │  .py     │   .py       │   │
│  └────┬─────┴────┬─────┴──────────┴─────────────┘   │
│       │          │                                   │
│  ┌────▼────┐ ┌───▼────┐                              │
│  │  Nmap   │ │ NVD    │                              │
│  │ (local) │ │ API    │                              │
│  └─────────┘ └────────┘                              │
│                                                      │
│  ┌──────────┐                                        │
│  │  Groq    │  ← AI brain (Llama 3.3 70B)           │
│  │  API     │                                        │
│  └──────────┘                                        │
└──────────────────────────────────────────────────────┘
```

## Technology Choices Explained

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | React 19 + Vite 8 | Fast, modern, huge ecosystem |
| Styling | Tailwind CSS 4 | No CSS files, rapid UI dev |
| Backend | Python FastAPI | Simple, async, auto-docs |
| AI | Groq API (Llama 3.3) | Free tier, fast, good quality |
| Scanner | python-nmap | Industry standard |
| CVE Data | NVD API | Official US gov source |
| PDF | ReportLab | Python native, professional |
| Auth | JWT (python-jose) | Stateless, standard |
| DB | SQLite (future) | Zero config, file-based |

## Security & Ethics

**CRITICAL RULES:**

1. **ONLY scan networks you own** — your PC (127.0.0.1), your home router, your lab
2. **NEVER scan without written permission** — illegal in most countries
3. **The scanner blocks non-private IPs** — this is intentional
4. **All attack simulations are educational** — for learning only
5. **Add disclaimers** in your jury presentation about authorized testing

## Getting Help

- FastAPI docs: http://localhost:8000/docs (auto-generated)
- React dev tools: browser extension
- Groq console: https://console.groq.com
- NVD API: https://nvd.nist.gov/developers

## Phase Summary

| Phase | What | Duration |
|-------|------|----------|
| 0 | Setup, git, requirements | Day 1 |
| 1 | Backend API + AI chat | Week 1-2 |
| 2 | Frontend layout + chat UI | Week 2-3 |
| 3 | Nmap scanner + AI analysis | Week 5-6 |
| 4 | CVE feed + Dashboard + Simulator | Week 7-8 |
| 5 | Report fusion + PDF generator | Week 9-10 |
| 6 | Auth + Polish + Demo prep | Week 11-12 |

## Demo Script (for Jury)

1. **Dashboard** (1 min) — Show security score, live CVE feed
2. **Scanner** (2 min) — Scan localhost, show ports + AI analysis
3. **Chat** (1 min) — Ask about SQL injection or XSS
4. **Simulator** (2 min) — Red Team on "Apache 2.4.49 on Ubuntu"
5. **Reports** (1 min) — Upload sample, fuse, download PDF

Total: ~7 minutes. Practice this flow before the jury.
