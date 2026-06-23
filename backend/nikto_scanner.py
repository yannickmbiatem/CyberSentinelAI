"""
nikto_scanner.py — Dedicated Nikto web vulnerability scanner for CyberSentinel AI.

Features:
  - Auto-discovers nikto.pl in the project directory or system PATH
  - Full scan options: target, port, SSL, tuning categories, max scan time
  - Parses raw Nikto output into structured findings with severity heuristics
  - Job-based async execution (scan runs in a thread, polled via job_id)
  - Returns OSVDB IDs, affected paths, descriptions, and severity tags

WARNING: Only scan systems you OWN or have WRITTEN AUTHORIZATION to test.
Unauthorized scanning is illegal under Cameroon Law No. 2010/012 and equivalents worldwide.
"""

import os
import re
import uuid
import subprocess
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse


# ── Job store (in-memory, keyed by job_id) ────────────────────────────────────
# Stores: {status, progress, findings, meta, error, started_at, finished_at}
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


# ── Nikto path discovery ───────────────────────────────────────────────────────
def find_nikto() -> str | None:
    """
    Try to find nikto.pl in multiple locations (order matters):
      1. Relative to project root: <project>/nikto/program/nikto.pl
      2. Legacy hardcoded: C:\\nikto\\program\\nikto.pl
      3. System PATH: 'nikto' command exists natively
    Returns the absolute path to nikto.pl, or None if not found.
    """
    # 1. Relative to THIS file: go up one level (backend/) → project root → nikto/program/nikto.pl
    this_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(this_dir)
    relative_path = os.path.join(project_root, "nikto", "program", "nikto.pl")
    if os.path.isfile(relative_path):
        return relative_path

    # 2. Legacy hardcoded path (original code assumption)
    legacy_path = r"C:\nikto\program\nikto.pl"
    if os.path.isfile(legacy_path):
        return legacy_path

    # 3. Check if 'nikto' is a command in PATH (Linux/macOS native install)
    try:
        result = subprocess.run(
            ["nikto", "--version"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 or "Nikto" in (result.stdout + result.stderr):
            return "nikto"  # Use as a direct command
    except Exception:
        pass

    return None  # Not found


def find_perl() -> str:
    """Find perl executable on the system."""
    # Common Windows locations
    candidates = [
        r"C:\Strawberry\perl\bin\perl.exe",
        r"C:\Perl64\bin\perl.exe",
        r"C:\Perl\bin\perl.exe",
        "perl",  # Hope it's in PATH
    ]
    for c in candidates:
        if c == "perl":
            try:
                subprocess.run(["perl", "--version"], capture_output=True, timeout=5)
                return "perl"
            except Exception:
                pass
        elif os.path.isfile(c):
            return c
    return "perl"  # Last resort


# ── Severity heuristics ────────────────────────────────────────────────────────
_SEVERITY_RULES = [
    # Keywords that map to severity levels (checked in order)
    (re.compile(r"sql.inject|union.select|blind.sql|error-based", re.I), "CRITICAL"),
    (re.compile(r"command.inject|remote.code.exec|rce|shell.upload|backdoor|webshell", re.I), "CRITICAL"),
    (re.compile(r"xss|cross.site.script|reflected|stored.script", re.I), "HIGH"),
    (re.compile(r"lfi|local.file|path.traversal|directory.traversal|\.\.\/", re.I), "HIGH"),
    (re.compile(r"rfi|remote.file.include", re.I), "HIGH"),
    (re.compile(r"csrf|cross.site.request.forgery", re.I), "HIGH"),
    (re.compile(r"default.password|default.credential|admin.admin|password.file", re.I), "HIGH"),
    (re.compile(r"phpinfo|debug.mode|stack.trace|exception.detail", re.I), "MEDIUM"),
    (re.compile(r"missing.header|x-frame-options|content-security-policy|x-xss-protection|strict-transport", re.I), "MEDIUM"),
    (re.compile(r"outdated|old.version|apache.[\d]|nginx.[\d]|php.[\d]|openssl.[\d]", re.I), "MEDIUM"),
    (re.compile(r"backup.file|\.bak|\.old|\.orig|\.swp|config.file", re.I), "MEDIUM"),
    (re.compile(r"directory.listing|index.of|listing.enabled", re.I), "MEDIUM"),
    (re.compile(r"cookie.no.httponly|cookie.no.secure|session.fixation", re.I), "MEDIUM"),
    (re.compile(r"robots.txt|sitemap.xml|\.git|\.svn|\.env|\.htaccess", re.I), "LOW"),
    (re.compile(r"server.banner|server.header|x-powered-by|technology.info", re.I), "LOW"),
    (re.compile(r"allowed.method|options.method|trace.method|put.method", re.I), "LOW"),
]


def _classify_severity(description: str) -> str:
    """Assign a severity based on the finding description text."""
    for pattern, severity in _SEVERITY_RULES:
        if pattern.search(description):
            return severity
    return "INFO"


# ── Output parser ──────────────────────────────────────────────────────────────
_OSVDB_RE = re.compile(r"OSVDB-(\d+):", re.I)
_CVE_RE = re.compile(r"CVE-\d{4}-\d+", re.I)
_PATH_RE = re.compile(r":\s(/[^\s:]+)")


def parse_nikto_output(raw_output: str) -> list[dict]:
    """
    Parse Nikto's stdout into a list of structured finding dicts.
    Each finding:
      {id, osvdb, cve, path, description, severity, raw}
    """
    findings = []
    seen = set()  # deduplicate identical descriptions

    for line in raw_output.splitlines():
        line = line.strip()
        # Nikto finding lines start with '+'
        if not line.startswith("+"):
            continue

        # Skip noise lines (version info, meta lines)
        skip_patterns = [
            "Target IP:", "Target Hostname:", "Target Port:", "Start Time:",
            "End Time:", "1 host(s) tested", "Nikto", "No web server found",
            "SSL Info:", "Issuer:", "Subject:", "Ciphers:", "Templ:",
            "+ Server:", "Uncommon header", "retrieved but not saved",
        ]
        if any(p.lower() in line.lower() for p in skip_patterns):
            continue

        text = line[1:].strip()  # Remove leading '+'
        if not text or len(text) < 10:
            continue

        # Deduplicate
        if text in seen:
            continue
        seen.add(text)

        # Extract OSVDB
        osvdb_match = _OSVDB_RE.search(text)
        osvdb = f"OSVDB-{osvdb_match.group(1)}" if osvdb_match else ""

        # Extract CVE
        cve_match = _CVE_RE.search(text)
        cve = cve_match.group(0) if cve_match else ""

        # Extract URL path
        path_match = _PATH_RE.search(text)
        path = path_match.group(1) if path_match else "/"

        # Clean description — strip OSVDB prefix
        description = _OSVDB_RE.sub("", text).strip().lstrip(":").strip()

        # Severity
        severity = _classify_severity(description)

        findings.append({
            "id": str(uuid.uuid4())[:8],
            "osvdb": osvdb,
            "cve": cve,
            "path": path,
            "description": description,
            "severity": severity,
            "raw": line,
        })

    return findings


def _severity_order(s: str) -> int:
    return {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}.get(s, 5)


def compute_severity_counts(findings: list[dict]) -> dict:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        sev = f.get("severity", "INFO")
        counts[sev] = counts.get(sev, 0) + 1
    return counts


# ── Core scanner ───────────────────────────────────────────────────────────────
def _build_nikto_command(
    nikto_path: str,
    target: str,
    port: int,
    ssl: bool,
    tuning: str,
    maxtime: str,
    output_format: str = "txt",
) -> list[str]:
    """Build the Nikto command list."""
    # If nikto_path ends in .pl, we need perl to run it
    if nikto_path.endswith(".pl"):
        perl = find_perl()
        cmd = [perl, nikto_path]
    else:
        cmd = [nikto_path]  # Native nikto command

    cmd += ["-h", target, "-p", str(port), "-maxtime", maxtime, "-nointeractive"]

    if ssl:
        cmd.append("-ssl")

    if tuning:
        cmd += ["-Tuning", tuning]

    # Output as plain text (easier to parse than XML for our purposes)
    cmd += ["-Format", output_format, "-output", "-"]  # '-' means stdout

    return cmd


def _run_scan_job(job_id: str, target: str, port: int, ssl: bool, tuning: str, maxtime: str):
    """
    Execute the Nikto scan in a background thread. Updates _jobs[job_id] in-place.
    """
    started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with _jobs_lock:
        _jobs[job_id].update({
            "status": "running",
            "started_at": started_at,
            "progress": 0,
            "output_lines": [],
        })

    nikto_path = find_nikto()
    if not nikto_path:
        with _jobs_lock:
            _jobs[job_id].update({
                "status": "error",
                "error": "Nikto not found. Ensure nikto/program/nikto.pl exists in the project directory.",
                "finished_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })
        return

    cmd = _build_nikto_command(nikto_path, target, port, ssl, tuning, maxtime)

    # Parse maxtime string to seconds for subprocess timeout
    maxtime_seconds = _parse_maxtime(maxtime) + 30  # +30s grace period

    try:
        # Stream output line by line for live progress
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        all_lines = []
        finding_count = 0

        deadline = time.time() + maxtime_seconds
        while True:
            if time.time() > deadline:
                process.kill()
                break

            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line = line.rstrip()
                all_lines.append(line)
                # Count findings in real-time (lines starting with '+' that look like findings)
                if line.startswith("+") and ":" in line and len(line) > 20:
                    finding_count += 1
                    with _jobs_lock:
                        _jobs[job_id]["progress"] = min(finding_count * 5, 90)
                        _jobs[job_id]["output_lines"] = list(all_lines[-50:])  # last 50 lines

        process.wait(timeout=5)
        raw_output = "\n".join(all_lines)
        findings = parse_nikto_output(raw_output)
        findings.sort(key=lambda f: _severity_order(f["severity"]))

        severity_counts = compute_severity_counts(findings)
        finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

        # Persist to DB
        try:
            from db import save_web_scan
            save_web_scan(target, port, ssl, findings, severity_counts)
        except Exception:
            pass

        with _jobs_lock:
            _jobs[job_id].update({
                "status": "done",
                "progress": 100,
                "findings": findings,
                "severity_counts": severity_counts,
                "target": target,
                "port": port,
                "ssl": ssl,
                "tuning": tuning,
                "maxtime": maxtime,
                "raw_output": raw_output,
                "finding_count": len(findings),
                "finished_at": finished_at,
                "nikto_path": nikto_path,
            })

    except Exception as e:
        with _jobs_lock:
            _jobs[job_id].update({
                "status": "error",
                "error": f"Scan execution failed: {e}",
                "finished_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })


def _parse_maxtime(maxtime: str) -> int:
    """Convert maxtime string like '2m', '30s', '5m' to seconds."""
    maxtime = maxtime.strip().lower()
    if maxtime.endswith("m"):
        return int(maxtime[:-1]) * 60
    if maxtime.endswith("s"):
        return int(maxtime[:-1])
    try:
        return int(maxtime)
    except Exception:
        return 120


# ── Public API ─────────────────────────────────────────────────────────────────
def start_nikto_scan(target: str, port: int = 80, ssl: bool = False,
                     tuning: str = "1234689", maxtime: str = "2m") -> str:
    """
    Start a Nikto scan in a background thread.
    Returns a job_id string that can be polled with get_job_status().
    """
    job_id = str(uuid.uuid4())

    # Normalize target — strip http(s):// prefix if present so Nikto handles it
    parsed = urlparse(target)
    if parsed.scheme in ("http", "https"):
        target_host = parsed.netloc or parsed.path
        if not ssl:
            ssl = (parsed.scheme == "https")
        if parsed.port:
            port = parsed.port
        elif parsed.scheme == "https":
            port = 443
        else:
            port = 80
        # Strip port from netloc if present
        target_host = target_host.split(":")[0] if ":" in target_host else target_host
        target = target_host

    with _jobs_lock:
        _jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "findings": [],
            "severity_counts": {},
            "target": target,
            "port": port,
            "ssl": ssl,
            "error": None,
            "started_at": None,
            "finished_at": None,
            "output_lines": [],
        }

    thread = threading.Thread(
        target=_run_scan_job,
        args=(job_id, target, port, ssl, tuning, maxtime),
        daemon=True,
    )
    thread.start()
    return job_id


def get_job_status(job_id: str) -> dict | None:
    """Return a copy of the job dict, or None if job_id doesn't exist."""
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        # Return a shallow copy without the full raw_output (large) unless done
        result = dict(job)
        if result.get("status") != "done":
            result.pop("raw_output", None)
        return result


def list_jobs() -> list[dict]:
    """Return all jobs (without raw_output) sorted by start time."""
    with _jobs_lock:
        jobs = []
        for jid, job in _jobs.items():
            j = dict(job)
            j["job_id"] = jid
            j.pop("raw_output", None)
            j.pop("output_lines", None)
            jobs.append(j)
    jobs.sort(key=lambda j: j.get("started_at") or "", reverse=True)
    return jobs


def get_nikto_info() -> dict:
    """Return info about the Nikto installation (for diagnostics)."""
    nikto_path = find_nikto()
    perl = find_perl()
    version = "unknown"

    if nikto_path:
        try:
            if nikto_path.endswith(".pl"):
                result = subprocess.run(
                    [perl, nikto_path, "--version"],
                    capture_output=True, text=True, timeout=10
                )
            else:
                result = subprocess.run(
                    [nikto_path, "--version"],
                    capture_output=True, text=True, timeout=10
                )
            out = result.stdout + result.stderr
            m = re.search(r"Nikto[^\d]*([\d.]+)", out, re.I)
            if m:
                version = m.group(1)
        except Exception:
            pass

    return {
        "available": nikto_path is not None,
        "path": nikto_path,
        "perl": perl,
        "version": version,
    }
