"""
db.py — minimal SQLite persistence for CyberSentinel AI.

Beginner note:
- Uses Python's built-in sqlite3 (no install needed, no server).
- Stores every scan and its computed score, so the Dashboard can show the
  LAST real score plus a short history for a trend line.
- One table is enough for a single-user demo.
"""
import sqlite3
import json
import os
from datetime import datetime, timezone, timedelta

if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/cybersentinel.db"
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "cybersentinel.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS scans (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    target           TEXT    NOT NULL,
    timestamp        TEXT    NOT NULL,          -- ISO-8601 UTC
    raw_results_json TEXT    NOT NULL,          -- full scan dict as JSON
    score            INTEGER NOT NULL,          -- 0..100
    risk_level       TEXT    NOT NULL,          -- Low | Medium | High | Critical
    breakdown_json   TEXT    NOT NULL,          -- list of {reason, points}
    open_ports       INTEGER NOT NULL DEFAULT 0,
    host_count       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp);

-- Web vulnerability scans (Nikto results).
CREATE TABLE IF NOT EXISTS web_scans (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    target           TEXT    NOT NULL,
    port             INTEGER NOT NULL DEFAULT 80,
    ssl              INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
    timestamp        TEXT    NOT NULL,
    findings_json    TEXT    NOT NULL,   -- list of finding dicts
    finding_count    INTEGER NOT NULL DEFAULT 0,
    critical_count   INTEGER NOT NULL DEFAULT 0,
    high_count       INTEGER NOT NULL DEFAULT 0,
    medium_count     INTEGER NOT NULL DEFAULT 0,
    low_count        INTEGER NOT NULL DEFAULT 0,
    info_count       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_web_scans_timestamp ON web_scans(timestamp);

-- Append-only audit trail: every scan decision (allowed or refused).
-- This is an ETHICAL CONTROL: every scan is attributable and reviewable.
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL,        -- ISO-8601 UTC
    target      TEXT    NOT NULL,
    target_kind TEXT    NOT NULL,        -- private|loopback|allowlisted_public|public|forbidden|invalid
    decision    TEXT    NOT NULL,        -- ALLOWED|REFUSED_NO_CONSENT|REFUSED_FORBIDDEN|REFUSED_RATE_LIMIT
    authorized  INTEGER NOT NULL,        -- 0/1 consent checkbox
    auth_basis  TEXT,                    -- free-text justification (logged)
    client_ip   TEXT,                    -- operator IP (request.client.host)
    scan_type   TEXT    NOT NULL         -- "network" | "web"
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
"""

_initialized = False


def _conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=5)
    conn.row_factory = sqlite3.Row   # rows behave like dicts -> row["score"]
    return conn


def init_db():
    """Create tables if they don't exist. Safe to call many times."""
    global _initialized
    conn = _conn()
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()
    _initialized = True


def _ensure_init():
    """Lazy init — first DB call creates the schema. Avoids deprecated startup hooks."""
    if not _initialized:
        init_db()


def save_scan(target, raw_results, score, risk_level, breakdown, open_ports, host_count):
    """Insert one scan. Returns the new scan id."""
    _ensure_init()
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    conn = _conn()
    cur = conn.execute(
        """INSERT INTO scans
           (target, timestamp, raw_results_json, score, risk_level,
            breakdown_json, open_ports, host_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (target, ts, json.dumps(raw_results), score, risk_level,
         json.dumps(breakdown), open_ports, host_count),
    )
    scan_id = cur.lastrowid
    conn.commit()
    conn.close()
    return scan_id


def get_latest_scan():
    """Most recent scan as a dict, or None if there are no scans yet."""
    _ensure_init()
    conn = _conn()
    row = conn.execute("SELECT * FROM scans ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None


def get_history(limit=10):
    """Oldest-to-newest list of {timestamp, score} for the trend line."""
    _ensure_init()
    conn = _conn()
    rows = conn.execute(
        "SELECT timestamp, score FROM scans ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]   # chronological for charting


# ── Audit log (ethical control: every scan decision is recorded) ───────────────
def log_audit(target, decision, classification, authorized,
              basis="", client_ip="", scan_type="network"):
    """Append one row to the audit trail. Never raises (best-effort)."""
    _ensure_init()
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        conn = _conn()
        conn.execute(
            """INSERT INTO audit_log
               (timestamp, target, target_kind, decision, authorized,
                auth_basis, client_ip, scan_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ts, target, classification.get("kind", "unknown"), decision,
             1 if authorized else 0, basis, client_ip, scan_type),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def count_recent_scans(window_seconds=60, scan_type=None):
    """Count ALLOWED scans in the last window_seconds (for rate limiting)."""
    _ensure_init()
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
    conn = _conn()
    if scan_type:
        n = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE decision='ALLOWED' AND scan_type=? AND timestamp >= ?",
            (scan_type, cutoff),
        ).fetchone()[0]
    else:
        n = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE decision='ALLOWED' AND timestamp >= ?",
            (cutoff,),
        ).fetchone()[0]
    conn.close()
    return n


def get_audit_log(limit=50):
    """Most recent audit rows (newest first) for the /api/audit view."""
    _ensure_init()
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Web scan persistence (Nikto) ───────────────────────────────────────────────
def save_web_scan(target: str, port: int, ssl: bool,
                  findings: list, severity_counts: dict) -> int:
    """Persist a completed Nikto web scan. Returns the new scan id."""
    _ensure_init()
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    conn = _conn()
    cur = conn.execute(
        """INSERT INTO web_scans
           (target, port, ssl, timestamp, findings_json, finding_count,
            critical_count, high_count, medium_count, low_count, info_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            target, port, 1 if ssl else 0, ts,
            json.dumps(findings), len(findings),
            severity_counts.get("CRITICAL", 0),
            severity_counts.get("HIGH", 0),
            severity_counts.get("MEDIUM", 0),
            severity_counts.get("LOW", 0),
            severity_counts.get("INFO", 0),
        ),
    )
    scan_id = cur.lastrowid
    conn.commit()
    conn.close()
    return scan_id


def get_latest_web_scan() -> dict | None:
    """Most recent web scan as a dict, or None."""
    _ensure_init()
    conn = _conn()
    row = conn.execute("SELECT * FROM web_scans ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row) if row else None


def get_web_scan_history(limit: int = 20) -> list[dict]:
    """Recent web scans (newest first) for the history view."""
    _ensure_init()
    conn = _conn()
    rows = conn.execute(
        """SELECT id, target, port, ssl, timestamp, finding_count,
                  critical_count, high_count, medium_count, low_count, info_count
           FROM web_scans ORDER BY id DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
