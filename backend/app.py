import os
import json
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from io import BytesIO

load_dotenv()

app = FastAPI(
    title="CyberSentinel AI",
    description="AI-Powered Security Report Analysis and Remediation Platform",
    version="1.0.0"
)

# Allow frontend (Vite dev + Vercel production) to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",     # Vercel preview deployments
        os.getenv("FRONTEND_URL", ""),  # Custom production URL via env
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Groq Configuration ────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are CyberSentinel AI, an expert cybersecurity analyst with 15+ years
of experience in penetration testing, vulnerability assessment, and security architecture.
You specialize in: Nmap analysis, CVE interpretation, OWASP Top 10, network security,
WiFi security (WPA2), web application security, and remediation planning.
Always be precise, technical, and practical. Provide exact commands when relevant.
When discussing offensive techniques, always note they must only be used on authorized
systems. Never assist with illegal activities.
CRITICAL RULE: You must ONLY answer questions related to cybersecurity, penetration testing, IT infrastructure, or networking. If a user asks a question that is not related to these topics (e.g., general knowledge, cooking, programming unrelated to security), you MUST politely decline to answer and state that your expertise is strictly limited to cybersecurity."""


async def call_groq(messages: list, max_tokens: int = 1024, temperature: float = 0.3, response_format: dict = None) -> str:
    """Central function to call Groq API. Used by all endpoints."""
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if response_format:
        payload["response_format"] = response_format

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CyberSentinel AI", "model": GROQ_MODEL}


# ── Chat Endpoint ─────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    context: str = ""

class ChatResponse(BaseModel):
    response: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    sys_prompt = SYSTEM_PROMPT
    if req.context:
        sys_prompt += f"\n\nCURRENT CONTEXT:\n{req.context}"
        
    messages = [{"role": "system", "content": sys_prompt}]
    for h in req.history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})
    ai_text = await call_groq(messages, max_tokens=2048)
    return ChatResponse(response=ai_text)


# ── Scanner Endpoint ──────────────────────────────────────────────────────────
class ScanRequest(BaseModel):
    target: str
    ports: str = "1-1024"

class ScanResponse(BaseModel):
    results: dict
    ai_analysis: str

@app.post("/api/scan", response_model=ScanResponse)
async def run_scan(req: ScanRequest, request: Request):
    """Network scan with policy enforcement, scoring, persistence, and AI analysis."""
    from policy import classify_target, is_rate_limited
    from db import log_audit

    # ── Policy gate ────────────────────────────────────────────────────────────
    client_ip = request.client.host if request.client else "unknown"
    classification = classify_target(req.target)
    target_kind = classification.get("kind", "unknown")

    # Block forbidden targets (cloud metadata, broadcast, etc.)
    if target_kind == "forbidden" or target_kind == "invalid":
        log_audit(req.target, "REFUSED_FORBIDDEN", classification,
                  authorized=False, client_ip=client_ip, scan_type="network")
        raise HTTPException(
            status_code=403,
            detail=f"Scan refused: target classified as '{target_kind}'. "
                   f"Scanning this address is not permitted."
        )

    # Rate limit check (5 scans per minute)
    if is_rate_limited(scan_type="network"):
        log_audit(req.target, "REFUSED_RATE_LIMIT", classification,
                  authorized=False, client_ip=client_ip, scan_type="network")
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 5 scans/minute.")

    # Log this scan as ALLOWED
    log_audit(req.target, "ALLOWED", classification,
              authorized=True, client_ip=client_ip, scan_type="network")

    # ── Execute scan ───────────────────────────────────────────────────────────
    from scanner import scan_target
    from fastapi.concurrency import run_in_threadpool
    scan_results = await run_in_threadpool(scan_target, req.target, req.ports)

    # Attach classification metadata to results for the frontend
    scan_results["target_classification"] = target_kind

    # Compute the security score and persist the scan (no network here — cves=[]).
    from scoring import compute_security_score
    from db import save_scan
    sc = compute_security_score(scan_results, cves=[])
    if sc["score"] is not None and not scan_results.get("error"):
        save_scan(
            req.target, scan_results, sc["score"], sc["risk_level"],
            sc["breakdown"], sc["open_ports"], sc["host_count"],
        )

    scan_json = json.dumps(scan_results, indent=2)
    prompt = f"""Analyze this network scan result and provide a professional security assessment:

SCAN DATA (includes Nmap port scan and optional Nikto web vulnerabilities):
{scan_json}

Provide:
1. **Executive Summary** — Brief overview of what was found
2. **Open Ports & Services Analysis** — For each open port, explain what the service does and its risk level
3. **Web Vulnerabilities** — If Nikto web scan results are present, explain the web-specific risks (XSS, missing headers, etc.)
4. **Security Risks** — List specific vulnerabilities or misconfigurations detected
5. **Recommended Hardening Steps** — Specific commands and actions to secure this system
6. **Priority Actions** — Top 3 things to fix immediately

Format your response clearly with sections."""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    ai_text = await call_groq(messages, max_tokens=3000)
    return ScanResponse(results=scan_results, ai_analysis=ai_text)


# ── CVE Feed Endpoint ─────────────────────────────────────────────────────────
@app.get("/api/cves")
async def cve_feed(days: int = 7, keyword: str = ""):
    from cve_feed import get_recent_cves
    # get_recent_cves now returns a full envelope:
    # {cves, count, source, stale, fetched_at, error}
    return await get_recent_cves(days, keyword)


# ── Dashboard Endpoint ────────────────────────────────────────────────────────
# One call powers the whole Security Dashboard: real score, risk, CVE count.
@app.get("/api/dashboard")
async def dashboard():
    import json as _json
    from db import get_latest_scan, get_history
    from cve_feed import get_recent_cves

    latest = get_latest_scan()
    history = get_history(limit=10)

    feed = await get_recent_cves(7, "")        # resilient envelope
    cve_count = feed.get("count", 0)
    cve_source = feed.get("source", "error")

    if latest is None:
        # No scan yet — be honest, no fake number.
        return {
            "score": None,
            "risk_level": "N/A",
            "breakdown": [],
            "cve_count_7d": cve_count,
            "cve_source": cve_source,
            "latest_scan_summary": None,
            "history": [],
        }

    try:
        breakdown = _json.loads(latest.get("breakdown_json") or "[]")
    except Exception:
        breakdown = []

    return {
        "score": latest["score"],
        "risk_level": latest["risk_level"],
        "breakdown": breakdown,
        "cve_count_7d": cve_count,
        "cve_source": cve_source,
        "latest_scan_summary": {
            "target": latest["target"],
            "timestamp": latest["timestamp"],
            "open_ports": latest["open_ports"],
            "host_count": latest["host_count"],
        },
        "history": history,
    }


# ── Attack Simulator Endpoint ─────────────────────────────────────────────────
class SimulateRequest(BaseModel):
    target_description: str
    mode: str = "red"

@app.post("/api/simulate")
async def simulate_attack(req: SimulateRequest):
    if req.mode == "red":
        prompt = f"""You are a professional Red Team operator conducting an authorized penetration test.
Target description: {req.target_description}

Provide a realistic, detailed attack simulation narrative with EXACTLY these phases:

## Phase 1: Reconnaissance
What information would you gather? What OSINT tools? What commands?

## Phase 2: Scanning & Enumeration
What scanners? Exact nmap commands? What are you looking for?

## Phase 3: Vulnerability Analysis
What vulnerabilities does this target likely have based on the description?

## Phase 4: Initial Access
What attack vectors would you attempt? What exploits? Exact tools?

## Phase 5: Post-Exploitation
What would you do after gaining access? Privilege escalation? Lateral movement?

DISCLAIMER: This simulation is for educational purposes only. Always obtain written authorization before testing any system you do not own."""
    else:
        prompt = f"""You are a professional Blue Team security architect.
Target to defend: {req.target_description}

Provide a comprehensive, actionable defense plan with EXACTLY these sections:

## Step 1: Immediate Hardening
What configuration changes to make right now? Exact commands?

## Step 2: Monitoring Setup
What to log? What alerts to configure? What tools to deploy?

## Step 3: Detection Rules
What IDS/IPS rules? What SIEM alerts? What behavioral patterns to watch?

## Step 4: Incident Response Procedures
Step-by-step response plan if this system is compromised.

## Step 5: Recovery & Continuity
Backup strategy, restore procedures, post-incident review."""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    ai_text = await call_groq(messages, max_tokens=3000, temperature=0.4)
    return {"mode": req.mode, "target": req.target_description, "analysis": ai_text}


# ── Report Fusion Endpoint ────────────────────────────────────────────────────
class ReportFusionRequest(BaseModel):
    nmap_data: str = ""
    nikto_data: str = ""
    wifi_data: str = ""
    target_name: str = "Unknown Target"

@app.post("/api/reports/fuse")
async def fuse_reports(req: ReportFusionRequest):
    sources = []
    if req.nmap_data:
        sources.append(f"=== NMAP SCAN REPORT ===\n{req.nmap_data}")
    if req.nikto_data:
        sources.append(f"=== NIKTO WEB SCAN REPORT ===\n{req.nikto_data}")
    if req.wifi_data:
        sources.append(f"=== WIFI ANALYZER REPORT ===\n{req.wifi_data}")

    if not sources:
        return {"analysis": "No report data provided. Please upload at least one security report."}

    combined = "\n\n".join(sources)

    prompt = f"""You are analyzing security reports for target: {req.target_name}

{combined}

Provide a unified 360 security assessment.
Format your response as a valid JSON object EXACTLY like this:
{{
  "analysis": "The full markdown string containing Executive Summary, Critical Findings, Risk Matrix, Cross-Tool Correlations, and Prioritized Remediation Plan. Use \\n for newlines.",
  "vulnerabilities": [
    {{
      "name": "Name of vulnerability",
      "severity": "CRITICAL", // Must be CRITICAL, HIGH, MEDIUM, LOW, or INFO
      "cve": "CVE-XXXX-XXXX", // Or empty string if none
      "description": "Short description",
      "fix": "Short remediation instructions",
      "command": "Commands to run, if applicable",
      "priority": 1 // Integer, 1 being highest priority
    }}
  ]
}}
DO NOT return any markdown formatting outside the JSON object. Just raw JSON.
"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    # Enforce JSON output format from Groq
    ai_text = await call_groq(messages, max_tokens=4000, response_format={"type": "json_object"})
    
    try:
        # Extract the JSON block
        clean_json = ai_text.strip()
        start_idx = clean_json.find('{')
        end_idx = clean_json.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            clean_json = clean_json[start_idx:end_idx + 1]
        
        parsed = json.loads(clean_json)
        return {
            "analysis": parsed.get("analysis", "Analysis could not be extracted."),
            "vulnerabilities": parsed.get("vulnerabilities", []),
            "target": req.target_name
        }
    except Exception as e:
        # Fallback if AI didn't follow JSON format strictly
        return {
            "analysis": f"**Warning:** Output format parsing failed. Raw output below:\n\n{ai_text}",
            "vulnerabilities": [],
            "target": req.target_name
        }


# ── PDF Generator Endpoint ────────────────────────────────────────────────────
class PDFRequest(BaseModel):
    vulnerabilities: list[dict]
    target: str
    analyst: str = "CyberSentinel AI"

@app.post("/api/reports/pdf")
async def generate_pdf_report(req: PDFRequest):
    from pdf_generator import generate_remediation_pdf
    pdf_bytes = generate_remediation_pdf(req.vulnerabilities, req.target, req.analyst)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=remediation_playbook_{req.target}.pdf"}
    )


# ── Authentication Endpoints ──────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    from auth import verify_password, create_token, USERS
    if req.username not in USERS or not verify_password(req.password, USERS[req.username]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(req.username)
    return LoginResponse(access_token=token, username=req.username)

@app.get("/api/auth/me")
async def me_endpoint():
    return {"status": "authenticated"}


# ── Audit Log Endpoint ────────────────────────────────────────────────────────
@app.get("/api/audit")
async def get_audit(limit: int = 50):
    """Return the most recent scan audit entries (ethical control log)."""
    from db import get_audit_log
    rows = get_audit_log(limit=limit)
    return {"entries": rows, "count": len(rows)}


# ── Scan History Endpoint ─────────────────────────────────────────────────────
@app.get("/api/scans/history")
async def scan_history(limit: int = 20):
    """Return scan history list for charting on the dashboard."""
    from db import get_history
    return {"history": get_history(limit=limit)}


# ── Target Policy Info Endpoint ───────────────────────────────────────────────
@app.get("/api/policy/classify")
async def classify(target: str):
    """Classify a target before scanning (for frontend pre-validation)."""
    from policy import classify_target
    return classify_target(target)


# ── Nikto Web Scanner Endpoints ───────────────────────────────────────────────
class NiktoScanRequest(BaseModel):
    target: str                          # URL, IP, or hostname
    port: int = 80                       # Target port
    ssl: bool = False                    # Force SSL/TLS
    tuning: str = "1234689"             # Nikto tuning categories (1=files,2=misconfig,3=info,4=inject,6=xss,8=exec,9=sql)
    maxtime: str = "2m"                  # Scan time limit: 30s / 2m / 5m

@app.post("/api/nikto/scan")
async def start_nikto_scan(req: NiktoScanRequest, request: Request):
    """
    Start a Nikto web vulnerability scan. Returns a job_id immediately.
    Poll /api/nikto/status/{job_id} for results.
    """
    from policy import classify_target, is_rate_limited
    from db import log_audit

    client_ip = request.client.host if request.client else "unknown"

    # Normalize target for policy classification
    from urllib.parse import urlparse
    parsed = urlparse(req.target if req.target.startswith("http") else f"http://{req.target}")
    target_host = parsed.hostname or req.target

    classification = classify_target(target_host)
    target_kind = classification.get("kind", "unknown")

    # Block forbidden targets
    if target_kind in ("forbidden", "invalid"):
        log_audit(req.target, "REFUSED_FORBIDDEN", classification,
                  authorized=False, client_ip=client_ip, scan_type="web")
        raise HTTPException(
            status_code=403,
            detail=f"Web scan refused: target classified as '{target_kind}'. "
                   f"Reason: {classification.get('reason', '')}"
        )

    # Rate limit check (3 web scans per minute)
    if is_rate_limited(scan_type="web"):
        log_audit(req.target, "REFUSED_RATE_LIMIT", classification,
                  authorized=False, client_ip=client_ip, scan_type="web")
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Max 3 web scans/minute. Please wait and try again."
        )

    # Log as ALLOWED
    log_audit(req.target, "ALLOWED", classification,
              authorized=True, client_ip=client_ip, scan_type="web")

    # Start the scan asynchronously
    from nikto_scanner import start_nikto_scan as _start
    job_id = _start(
        target=req.target,
        port=req.port,
        ssl=req.ssl,
        tuning=req.tuning,
        maxtime=req.maxtime,
    )

    return {
        "job_id": job_id,
        "status": "started",
        "target": req.target,
        "target_classification": target_kind,
        "message": f"Nikto scan started. Poll /api/nikto/status/{job_id} for results.",
    }


@app.get("/api/nikto/status/{job_id}")
async def nikto_scan_status(job_id: str):
    """Poll a Nikto scan job for status and results."""
    from nikto_scanner import get_job_status
    job = get_job_status(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


@app.post("/api/nikto/analyze")
async def analyze_nikto_findings(job_id: str):
    """
    Run AI analysis on a completed Nikto scan job.
    Returns markdown analysis from Groq.
    """
    from nikto_scanner import get_job_status
    job = get_job_status(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    if job.get("status") != "done":
        raise HTTPException(status_code=400, detail="Scan not yet complete. Wait for status=done.")

    findings = job.get("findings", [])
    severity_counts = job.get("severity_counts", {})
    target = job.get("target", "unknown")
    port = job.get("port", 80)

    if not findings:
        return {"analysis": "No web vulnerabilities were found by Nikto on this target.", "job_id": job_id}

    # Build a structured summary for the AI
    findings_text = "\n".join([
        f"- [{f['severity']}] {f['description']}"
        + (f" (Path: {f['path']})" if f.get("path") and f["path"] != "/" else "")
        + (f" [{f['osvdb']}]" if f.get("osvdb") else "")
        for f in findings[:40]  # limit tokens
    ])

    prompt = f"""You are analyzing a Nikto web vulnerability scan for CyberSentinel AI.

TARGET: {target}:{port}
TOTAL FINDINGS: {len(findings)}
SEVERITY BREAKDOWN: {severity_counts}

FINDINGS:
{findings_text}

Provide a professional web security assessment with EXACTLY these sections:

## Executive Summary
Brief overview of the web security posture and key risks.

## Critical & High Severity Findings
Explain each critical/high finding in detail: what it means, how it can be exploited. If there are none, explicitly state so.

## Attack Surface Analysis
What attack vectors does this expose? OWASP Top 10 mapping where applicable. If the findings are purely informational (e.g., scan timeouts or max execution time reached) and do not expose an attack vector, state that no specific attack surface was exposed by these findings. DO NOT hallucinate or invent vulnerabilities (like SSRF) for timeouts.

## Recommended Remediation
Specific fixes with exact configuration examples or code snippets for each finding. If the finding is just a scan timeout, recommend increasing the scan timeout or running a more targeted scan, without suggesting unnecessary mitigations like a WAF.

## Priority Actions (Top 5)
The 5 most urgent things to fix, in order. If there are no severe findings, provide recommendations to improve the scan reliability or state that no immediate priority actions are required.

Be technical, precise, and provide actionable commands."""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    ai_text = await call_groq(messages, max_tokens=3500, temperature=0.2)
    return {"analysis": ai_text, "job_id": job_id, "target": target}


@app.get("/api/nikto/history")
async def nikto_history(limit: int = 20):
    """Return web scan history from the database."""
    from db import get_web_scan_history
    return {"history": get_web_scan_history(limit=limit)}


@app.get("/api/nikto/info")
async def nikto_info():
    """Return information about the Nikto installation on this server."""
    from nikto_scanner import get_nikto_info
    return get_nikto_info()


# ── Run Server ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("CyberSentinel AI Backend starting...")
    print("API docs available at: http://localhost:8000/docs")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
