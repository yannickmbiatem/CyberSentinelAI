# CyberSentinel AI — Comprehensive Project State Document
> Generated: 2026-06-17 | Status: Active Development

---

## 1. Project Overview

**CyberSentinel AI** is an AI-powered cybersecurity analysis and remediation platform built as a student capstone project at ICT University. It combines real network scanning tools (Nmap, Nikto), live CVE intelligence from NIST NVD, and a large language model (Groq/LLaMA-3) to provide a complete, end-to-end security assessment platform.

### Core Philosophy
- **Not just a chatbot** — integrates real tooling (Nmap, Nikto, Perl-based scanners)
- **Live data, not static** — NVD API, real scans, persistent scan history
- **Educational + Professional** — ethical controls baked in (audit logging, authorization enforcement)
- **Dual perspective** — Red Team (attacker) and Blue Team (defender) simulation modes

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                  │
│   Dashboard │ AI Chat │ Scanner │ Reports │ Simulator │ CVE  │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP (proxied via Vite)
                           │  API Base: /api → localhost:8000
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Python FastAPI)                   │
│  app.py — main router + all endpoints                        │
│  auth.py — JWT authentication (HS256)                        │
│  scanner.py — Nmap + Socket + Nikto engines                  │
│  scoring.py — deterministic security score (0–100)           │
│  cve_feed.py — NVD API with resilient fallback chain         │
│  db.py — SQLite persistence (scans + audit log)              │
│  pdf_generator.py — ReportLab PDF playbook generator         │
│  policy.py — authorization policy (target classification)    │
└──────┬───────────┬────────────────┬────────────────────────┘
       │           │                │
  ┌────▼───┐  ┌────▼────┐  ┌───────▼──────┐
  │  Nmap  │  │  Nikto  │  │  Groq API    │
  │ Engine │  │ (Perl)  │  │ LLaMA-3 70B  │
  └────────┘  └─────────┘  └──────────────┘
       │
  ┌────▼──────────┐    ┌────────────────────┐
  │  SQLite DB    │    │  NIST NVD API      │
  │  cybersentinel│    │  (Live CVE data)   │
  │  .db          │    └────────────────────┘
  └───────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| Frontend | React + Vite | React 18, Vite 8.x |
| Routing | React Router DOM | v6 |
| Icons | Lucide React | latest |
| File Uploads | react-dropzone | Reports page |
| Styling | Vanilla CSS (custom design system) | Dark theme, glassmorphism |
| Backend | Python FastAPI | ASGI, async |
| Server | Uvicorn | with hot-reload |
| AI Engine | Groq API (LLaMA-3.3 70B Versatile) | via httpx |
| Scanner Engine 1 | Nmap + python-nmap | `-sV -sC --open -T4` |
| Scanner Engine 2 | Python socket (fallback) | Pure stdlib TCP scan |
| Scanner Engine 3 | Nikto (via Perl subprocess) | Web vulnerability scanner |
| CVE Feed | NIST NVD API v2.0 | with local cache + sample fallback |
| Database | SQLite 3 | Built-in, no server needed |
| Authentication | JWT (python-jose) + bcrypt (passlib) | HS256, 8h tokens |
| PDF Generation | ReportLab | Professional A4 playbook |
| HTTP Client | httpx | async |
| Env Config | python-dotenv | .env file |

---

## 4. Backend — Module-by-Module Breakdown

### 4.1 `app.py` — Main FastAPI Application
**Port:** 8000 | **Docs:** http://localhost:8000/docs

#### Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check: returns status + model name |
| POST | `/api/chat` | AI cybersecurity chat (Groq LLaMA-3) |
| POST | `/api/scan` | Network scan (Nmap/Socket/Nikto) + AI analysis |
| GET | `/api/cves` | CVE feed from NVD (days, keyword params) |
| GET | `/api/dashboard` | Aggregated dashboard data (score + CVEs + history) |
| POST | `/api/simulate` | Red/Blue team attack simulation |
| POST | `/api/reports/fuse` | Multi-tool report fusion (Nmap + Nikto + WiFi) |
| POST | `/api/reports/pdf` | PDF remediation playbook generation |
| POST | `/api/auth/login` | JWT login (returns access_token) |
| GET | `/api/auth/me` | Token validation |

**CORS:** Allows `localhost:5173` and `localhost:3000`

**AI System Prompt:** CyberSentinel AI plays the role of a 15+ year expert in penetration testing, CVE analysis, OWASP Top 10, WiFi security, and remediation planning.

---

### 4.2 `scanner.py` — Multi-Engine Network Scanner

**Three scanning engines with automatic fallback:**

#### Engine 1: Nmap (Preferred)
- Requires `nmap` binary installed on the system
- Command flags: `-sV -sC -p {ports} --open -T4`
- Returns: service name, product, version, CPE, OS guess
- Uses `python-nmap` wrapper library

#### Engine 2: Python Socket (Fallback)
- Used when Nmap binary is not found
- Pure Python stdlib (no external dependencies)
- Uses `ThreadPoolExecutor` with 100 workers for parallel port scanning
- Returns: open/closed state, best-effort service name via `socket.getservbyport`
- No version detection (limitation vs Nmap)

#### Engine 3: Nikto Web Scanner (Conditional)
- Triggered **automatically** after port scan if web ports are open (80, 443, 8080, 8443)
- Runs as a subprocess: `perl C:\nikto\program\nikto.pl -h {target} -maxtime 45s`
- Subprocess timeout: 60 seconds (failsafe)
- Output: filters lines starting with `+` (Nikto finding prefix)
- Limited to 30 lines to avoid AI token explosion
- Result stored in `web_vulnerabilities` key of scan result dict

**Port parsing:** Supports ranges (`1-1024`), lists (`80,443`), or combined (`22,80,1000-1010`)

**Return shape (always consistent):**
```json
{
  "target": "...",
  "ports_scanned": "...",
  "hosts": [...],
  "scan_info": {...},
  "total_hosts": 1,
  "engine": "nmap|socket|none",
  "web_vulnerabilities": "...",  // Only if web ports found
  "note": "...",                  // Optional engine note
  "error": "..."                  // Only on failure
}
```

---

### 4.3 `scoring.py` — Deterministic Security Score

Computes a **0–100 security posture score** from scan results. Pure arithmetic, no network calls.

**Algorithm:**
1. Start at **100** (perfect posture)
2. Subtract penalty for each **risky service** found open (by service name, then port number)
3. Subtract **outdated software** penalty (known CVE-linked versions: vsftpd 2.3.4, Apache 2.4.49/50, OpenSSL 1.0.1)
4. Correlate open CVEs with detected software (keyword heuristic)
5. Subtract **attack surface bonus** (penalty for large port count: `min(10, open_ports - 3)`)

**Risk Labels:**
- Score ≥ 80 → **Low**
- Score 60–79 → **Medium**
- Score 40–59 → **High**
- Score < 40 → **Critical**

**Risky Services Penalties:**
| Service | Penalty |
|---------|---------|
| Telnet (23) | -25 |
| FTP (21) | -15 |
| SMB/NetBIOS (445/139) | -15 each |
| RDP (3389) | -15 |
| VNC | -12 |
| MySQL/PostgreSQL/MongoDB/Redis | -8 each |
| HTTP (80) | -3 |
| SNMP/RPC | -6 each |
| Any other open port | -1 |

---

### 4.4 `cve_feed.py` — Resilient NVD CVE Feed

**Fallback chain (never crashes the UI):**
1. **LIVE** → NVD API v2.0 (`https://services.nvd.nist.gov/rest/json/cves/2.0`)
2. **CACHE** → Last successful response saved to `.cache/` directory (JSON files)
3. **SAMPLE** → Bundled `sample_cves.json` (works fully offline)
4. **ERROR envelope** → Returns empty list with error metadata

**Envelope format:**
```json
{
  "cves": [...],
  "count": 20,
  "source": "live|cached|sample|error",
  "stale": false,
  "fetched_at": "2026-06-17T...",
  "error": null
}
```

Cache TTL: 6 hours. Cache files named: `nvd_{days}d_{keyword}.json`

---

### 4.5 `db.py` — SQLite Persistence

**Tables:**

`scans` — Stores every completed scan:
- target, timestamp, raw_results_json, score, risk_level, breakdown_json, open_ports, host_count

`audit_log` — **Ethical control** — Every scan decision recorded:
- target, target_kind (private/public/forbidden/etc.), decision (ALLOWED/REFUSED), authorized, auth_basis, client_ip, scan_type

**Functions:** `save_scan()`, `get_latest_scan()`, `get_history(limit)`, `log_audit()`, `count_recent_scans()`, `get_audit_log()`

---

### 4.6 `auth.py` — JWT Authentication

- **Users:** Hardcoded dict (demo): `admin/cybersentinel2025`, `yannick/ictuniversity2025`
- **Token:** JWT HS256, 8-hour expiry
- **Secret:** From `.env` `SECRET_KEY` (has default, must change in production)
- **Dependency:** `verify_token` FastAPI dependency (not currently applied to most routes)

---

### 4.7 `policy.py` — Authorization Policy

Classifies every scan target before network access:

| Kind | Example | Requires Consent? |
|------|---------|------------------|
| `loopback` | 127.0.0.1 | No |
| `private` | 192.168.1.1 | No |
| `allowlisted_public` | scanme.nmap.org | No (owner published consent) |
| `public` | 8.8.8.8 | Yes |
| `forbidden` | 169.254.x.x (cloud metadata) | Always refused |
| `invalid` | empty string | Refused |

**Pre-authorized demo targets:** scanme.nmap.org, testphp.vulnweb.com, demo.testfire.net, badssl.com, OWASP Juice Shop, etc.

**Rate limits:** 5 scans/min (network), 3 web scans/min

> ⚠️ Note: `policy.py` defines these classifications but the current `app.py` `/api/scan` endpoint does NOT enforce them (validation was removed). The policy module exists but is not integrated in the scan flow.

---

### 4.8 `pdf_generator.py` — ReportLab PDF Generation

Generates professional A4 PDF remediation playbooks with:
- Cover header (CyberSentinel AI branding)
- Meta table (target, analyst, timestamp, issue count)
- Vulnerability summary table with severity color coding
- Severity count bar (CRITICAL/HIGH/MEDIUM/LOW)
- Detailed remediation steps per vulnerability (description, fix, command)
- Footer with ethical/legal disclaimer

Style: Dark theme (#0a0e17 background, #00f0ff accent, severity colors)

---

## 5. Frontend — Page-by-Page Breakdown

### 5.1 Dashboard (`/dashboard` or `/`)

**Purpose:** Security posture overview — the "home base" of the platform.

**What it does:**
- Calls `GET /api/dashboard` → gets latest scan score, risk level, scan history
- Calls `GET /api/cves?days=7` → gets recent CVEs for the feed panel
- Shows animated **Security Score ring** (SVG, animates from 0 to score over 1.2s)
- Shows **CVE count** (last 7 days), broken down by Critical/High
- Shows **Risk Level** card (color-coded: green/orange/red)
- Shows **Quick Actions** (Run Scan, AI Chat, Simulate Attack)
- Shows **Live CVE Feed** (first 8 results, filterable by severity)
- Shows source badge if CVE data is stale (cached/sample/offline)

**State:** `cves[]`, `filteredCves[]`, `loading`, `filter`, `dash`, `cveSource`

---

### 5.2 AI Chat (`/chat`)

**Purpose:** Conversational cybersecurity assistant.

**What it does:**
- Sends messages to `POST /api/chat` with full conversation history (last 10 messages)
- Renders AI responses as Markdown (via `MarkdownRenderer` component)
- **Quick Prompts** bar with 6 pre-set security questions
- **Copy button** on each AI response
- **Typing indicator** (animated dots) while waiting
- `Ctrl+Enter` to send (keyboard shortcut)
- Clear chat button resets to welcome message
- Auto-scrolls to latest message

**State:** `messages[]`, `input`, `loading`

---

### 5.3 Network Scanner (`/scanner`)

**Purpose:** Live network scanning with AI analysis.

**What it does:**
- Target input (IP or hostname)
- **4 scan profiles:** Quick (13 ports), Standard (1–1024), Extended (1–10000), Full (1–65535)
- Sends to `POST /api/scan` → triggers Nmap/Socket scan + optional Nikto web scan
- **Elapsed timer** during scan (seconds counter)
- Results table: Port | Protocol | State | Service | Version | Risk
- **Risk badges** for known dangerous ports (Telnet=CRITICAL, SMB=CRITICAL, RDP=CRITICAL, etc.)
- **Export JSON** button for scan results
- **AI Security Analysis** rendered as Markdown below results
- If Nikto ran, AI analysis includes web vulnerability section

**Scan Profiles:**

| Profile | Port Range | Description |
|---------|-----------|-------------|
| Quick | 21,22,23,25,53,80,110,135,443,445,3389,8080,8443 | Top 13 |
| Standard | 1–1024 | Common ports |
| Extended | 1–10000 | Extended range |
| Full | 1–65535 | All ports (slow) |

**State:** `target`, `profile`, `showProfiles`, `loading`, `results`, `analysis`

---

### 5.4 Reports — Multi-Tool Fusion (`/reports`)

**Purpose:** Upload and AI-fuse multiple security tool outputs.

**What it does:**
- Three drag-and-drop upload zones: **Nmap report**, **Nikto report**, **WiFi scan**
- Target name input (optional, for report labeling)
- Sends all file contents to `POST /api/reports/fuse`
- AI generates a unified 360° analysis:
  - Executive Summary
  - Critical Findings (numbered)
  - Risk Matrix table
  - Cross-Tool Correlations
  - Prioritized Remediation Plan
  - Overall Security Score
- **PDF Playbook** button → triggers `POST /api/reports/pdf` → downloads PDF
  - Currently uses hardcoded demo vulnerabilities (not derived from fused analysis)

**File types accepted:** `.txt`, `.xml`, `.json`, `.nmap`

**State:** `nmapFile`, `niktoFile`, `wifiFile`, `targetName`, `analysis`, `loading`, `pdfLoading`

---

### 5.5 Attack Simulator (`/simulator`)

**Purpose:** AI-powered Red Team / Blue Team scenario generation.

**What it does:**
- Target description input (free text, e.g., "Apache 2.4.49 on Ubuntu 20.04")
- **Mode toggle:** Red Team (attack) or Blue Team (defense)
- Sends to `POST /api/simulate` → Groq generates structured simulation
- Results parsed into **expandable phase cards** (collapsible accordion)
- **Red Team phases:** Reconnaissance → Scanning & Enumeration → Vulnerability Analysis → Initial Access → Post-Exploitation
- **Blue Team steps:** Immediate Hardening → Monitoring Setup → Detection Rules → Incident Response → Recovery & Continuity
- Falls back to raw text display if phase parsing fails
- Each phase has emoji icon, color-coded by team (red/blue)

**State:** `target`, `mode`, `result`, `loading`, `expandedPhases`

---

### 5.6 CVE Intelligence Feed (`/cve-feed`)

**Purpose:** Search and browse recent CVEs from NVD.

**What it does:**
- Keyword search input + time range selector (1, 7, 14, 30 days)
- `Enter` key or Search button triggers `GET /api/cves?days=&keyword=`
- Severity filter pills (ALL / CRITICAL / HIGH / MEDIUM / LOW) with counts
- Results table: CVE ID | Severity | CVSS Score (with mini meter bar) | Published | Description | NVD Link
- **Pagination** (10 per page, prev/next)
- Quick-fill keyword buttons (apache, windows, ssh, log4j, openssl, chrome)
- Loading skeletons during search

**State:** `cves[]`, `loading`, `hasSearched`, `keyword`, `days`, `severityFilter`, `page`

---

## 6. Frontend Components

### `Layout.jsx`
- Fixed sidebar (240px) with navigation
- Backend health indicator (polling every 30s via `/api/health`)
- Status indicator: green (online) / orange (checking) / red (offline) with glow effect
- Brand logo area with shield icon
- Main content area with `<Outlet />` for React Router

### `MarkdownRenderer.jsx`
- Renders AI markdown responses using `react-markdown` + `remark-gfm`

### `CopyButton.jsx`
- One-click copy to clipboard for AI responses

---

## 7. Design System

**Theme:** Dark cyberpunk aesthetic
- Background: `#060b14` (primary), `#0d1117` (secondary), `#111827` (card)
- Accent: `#00e5ff` (cyan) with glow effects
- Text: `#f0f4f8` (primary), `#94a3b8` (secondary), `#4a5568` (muted)
- Fonts: **Inter** (body), **JetBrains Mono** (code/ports)
- Effects: Glassmorphism cards, box-shadow glows, fade-up entrance animations
- Animations: `spin-slow` (loading spinners), `blink` (typing dots), `animate-fade-up`

**Badge System:** `.badge-critical` (red), `.badge-high` (orange), `.badge-medium` (yellow), `.badge-low` (green), `.badge-info` (blue)

---

## 8. Configuration & Environment

### Backend `.env`
```
GROQ_API_KEY=gsk_...         # Required: Groq API key
GROQ_MODEL=llama-3.3-70b-versatile
NVD_API_KEY=                 # Optional: higher NVD rate limits
SECRET_KEY=...               # JWT signing secret (change in production!)
```

### Vite Proxy (vite.config.js)
```js
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

### Running the App
```bash
# Backend
cd backend
.\venv\Scripts\Activate.ps1
python app.py   # → http://localhost:8000

# Frontend
cd frontend
npm run dev    # → http://localhost:5173
```

---

## 9. Database Schema

```sql
CREATE TABLE scans (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    target           TEXT    NOT NULL,
    timestamp        TEXT    NOT NULL,          -- ISO-8601 UTC
    raw_results_json TEXT    NOT NULL,
    score            INTEGER NOT NULL,          -- 0..100
    risk_level       TEXT    NOT NULL,
    breakdown_json   TEXT    NOT NULL,
    open_ports       INTEGER NOT NULL DEFAULT 0,
    host_count       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL,
    target      TEXT    NOT NULL,
    target_kind TEXT    NOT NULL,
    decision    TEXT    NOT NULL,
    authorized  INTEGER NOT NULL,
    auth_basis  TEXT,
    client_ip   TEXT,
    scan_type   TEXT    NOT NULL
);
```

---

## 10. Known Issues / Current Limitations

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | `policy.py` not integrated in scan flow | `app.py` `/api/scan` | No authorization enforcement on public scans |
| 2 | JWT auth not applied to most endpoints | `app.py` | All endpoints are publicly accessible |
| 3 | Nikto path hardcoded to `C:\nikto\program\nikto.pl` | `scanner.py` | Not portable (Windows only, fixed path) |
| 4 | PDF downloads hardcoded demo vulnerabilities | `Reports.jsx` | PDF doesn't reflect actual fused analysis |
| 5 | No scan history chart on Dashboard | `Dashboard.jsx` | History data fetched but not visualized |
| 6 | CVE feed on Dashboard loads but doesn't auto-refresh | `Dashboard.jsx` | Stale data until page reload |
| 7 | Chat history NOT persisted | `Chat.jsx` | Session lost on page refresh |
| 8 | No input validation on scan target | `app.py` | Could scan arbitrary IPs |
| 9 | Rate limiting defined in `policy.py` but not enforced | `db.py`, `app.py` | No protection against abuse |
| 10 | `datetime.utcnow()` deprecated in Python 3.12+ | `cve_feed.py` | Deprecation warning |

---

## 11. Improvement Roadmap (Page by Page)

### Phase 1: Dashboard
- [ ] Add scan history trend chart (data already available in `dash.history`)
- [ ] Auto-refresh every 60s
- [ ] Show breakdown of last scan scoring

### Phase 2: Scanner
- [ ] Show Nikto results in dedicated UI section (currently only in AI text)
- [ ] Add Nikto status indicator (running/not run/not found)
- [ ] Make Nikto path configurable via env var
- [ ] Show scan engine used (nmap/socket) in results header
- [ ] Add port risk tooltips

### Phase 3: AI Chat
- [ ] Persist chat history in localStorage
- [ ] Allow file attachment (paste scan results for analysis)
- [ ] Token usage indicator

### Phase 4: Reports
- [ ] Connect PDF generation to actual fused analysis (not hardcoded demo)
- [ ] Allow manual vulnerability entry
- [ ] Show report preview before PDF download

### Phase 5: Simulator
- [ ] Export simulation as PDF
- [ ] Save simulation history
- [ ] Add MITRE ATT&CK technique mapping

### Phase 6: CVE Feed
- [ ] Auto-load on page entry (vs requiring explicit search)
- [ ] Subscribe/alert for new CVEs matching saved keywords
- [ ] Link CVEs to scanner results

### Phase 7: Security & Production
- [ ] Apply JWT auth to all sensitive endpoints
- [ ] Integrate `policy.py` into scan flow
- [ ] Make Nikto path configurable
- [ ] Enforce rate limiting

---

## 12. File Tree

```
CyberSentinelAI/
├── backend/
│   ├── app.py              # FastAPI main app (all routes)
│   ├── auth.py             # JWT authentication
│   ├── cve_feed.py         # NVD CVE API integration
│   ├── db.py               # SQLite persistence
│   ├── pdf_generator.py    # ReportLab PDF generation
│   ├── policy.py           # Target authorization policy
│   ├── scanner.py          # Nmap + Socket + Nikto scan engines
│   ├── scoring.py          # Security score computation
│   ├── seed_demo.py        # Demo data seeder
│   ├── test_groq.py        # Groq API test script
│   ├── test_scoring.py     # Scoring unit tests
│   ├── requirements.txt    # Python dependencies
│   ├── sample_cves.json    # Offline CVE fallback data
│   ├── cybersentinel.db    # SQLite database (auto-created)
│   └── .env                # Environment variables (secret)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Router setup (6 routes)
│   │   ├── api.js          # API client (fetch wrappers)
│   │   ├── index.css       # Global design system
│   │   ├── main.jsx        # React entry point
│   │   ├── components/
│   │   │   ├── Layout.jsx          # Sidebar + health check
│   │   │   ├── MarkdownRenderer.jsx # Markdown display
│   │   │   └── CopyButton.jsx      # Copy to clipboard
│   │   └── pages/
│   │       ├── Dashboard.jsx   # Security posture overview
│   │       ├── Chat.jsx        # AI cybersecurity chat
│   │       ├── Scanner.jsx     # Network scanner UI
│   │       ├── Reports.jsx     # Multi-tool report fusion
│   │       ├── Simulator.jsx   # Red/Blue team simulator
│   │       └── CVEFeed.jsx     # NVD CVE intelligence feed
│   └── vite.config.js      # Vite + proxy config
│
├── nikto/                  # Nikto web scanner (Perl)
├── CyberSentinel_AI_Full_Documentation.docx  # Main thesis doc
└── CyberSentinelAI_Project_State.md          # THIS FILE
```

---

*Last updated: 2026-06-17 | By: CyberSentinel AI Assistant*
