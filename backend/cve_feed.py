"""
cve_feed.py — NIST National Vulnerability Database (NVD) API integration,
made RESILIENT so the dashboard never breaks, even with no internet.

Fallback chain on every request:
    LIVE (NVD API)  ->  CACHE (last good response on disk)  ->  SAMPLE (bundled file)

The function always returns an ENVELOPE (never raises to the caller):
    {
      "cves": [...],          # list of CVE dicts (may be empty)
      "count": int,
      "source": "live" | "cached" | "sample" | "error",
      "stale": bool,          # True when cache is served because live failed
      "fetched_at": str,      # ISO timestamp of the data
      "error": None | {"kind": str, "message": str, "detail": str}
    }

Get a free NVD API key (higher rate limits) at:
    https://nvd.nist.gov/developers/request-an-api-key
"""
import httpx
import os
import json
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

NVD_API_KEY = os.getenv("NVD_API_KEY", "")
NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

_HERE = os.path.dirname(__file__)
CACHE_DIR = "/tmp/.cache"
SAMPLE_PATH = os.path.join(_HERE, "sample_cves.json")
CACHE_TTL_HOURS = 6


# ── Helpers ────────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _cache_path(days: int, keyword: str) -> str:
    safe_kw = "".join(c for c in keyword.lower().strip() if c.isalnum()) or "all"
    return os.path.join(CACHE_DIR, f"nvd_{days}d_{safe_kw}.json")


def _read_cache(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _write_cache(path: str, cves: list, fetched_at: str):
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"cves": cves, "fetched_at": fetched_at}, f)
        os.replace(tmp, path)   # atomic
    except Exception:
        pass   # cache is an optimization, never fatal


def _read_sample():
    try:
        with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _classify_error(exc: Exception) -> dict:
    """Turn a raw exception into a friendly, UI-safe error object."""
    name = type(exc).__name__
    detail = str(exc)
    low = detail.lower()
    if "getaddrinfo" in low or "name or service not known" in low or "11001" in low:
        kind, message = "dns", "Cannot reach NVD (DNS/no internet)."
    elif "timeout" in low or "ConnectTimeout" in name or "ReadTimeout" in name:
        kind, message = "timeout", "NVD took too long to respond."
    elif "ConnectError" in name or "connection" in low:
        kind, message = "network", "Network error reaching NVD."
    else:
        kind, message = "unknown", "Could not load live CVE data."
    return {"kind": kind, "message": message, "detail": detail}


def _parse_nvd(data: dict) -> list[dict]:
    """Turn the raw NVD JSON into our compact CVE list."""
    cves = []
    for item in data.get("vulnerabilities", []):
        cve_data = item.get("cve", {})

        descriptions = cve_data.get("descriptions", [])
        description = next(
            (d["value"] for d in descriptions if d.get("lang") == "en"),
            "No description available",
        )

        metrics = cve_data.get("metrics", {})
        severity, score = "UNKNOWN", 0.0
        if metrics.get("cvssMetricV31"):
            cvss = metrics["cvssMetricV31"][0].get("cvssData", {})
            severity = cvss.get("baseSeverity", "UNKNOWN")
            score = cvss.get("baseScore", 0.0)
        elif metrics.get("cvssMetricV30"):
            cvss = metrics["cvssMetricV30"][0].get("cvssData", {})
            severity = cvss.get("baseSeverity", "UNKNOWN")
            score = cvss.get("baseScore", 0.0)
        elif metrics.get("cvssMetricV2"):
            score = metrics["cvssMetricV2"][0].get("cvssData", {}).get("baseScore", 0.0)
            severity = "HIGH" if score >= 7.0 else "MEDIUM" if score >= 4.0 else "LOW"

        affected = []
        for config in cve_data.get("configurations", []):
            for node in config.get("nodes", []):
                for cpe_match in node.get("cpeMatch", []):
                    if cpe_match.get("vulnerable"):
                        parts = cpe_match.get("criteria", "").split(":")
                        if len(parts) > 4:
                            affected.append(f"{parts[3]} {parts[4]}")

        cves.append({
            "id": cve_data.get("id", ""),
            "description": description[:300] + "..." if len(description) > 300 else description,
            "severity": severity,
            "score": score,
            "published": cve_data.get("published", "")[:10],
            "affected": list(set(affected))[:3],
            "url": f"https://nvd.nist.gov/vuln/detail/{cve_data.get('id', '')}",
        })

    cves.sort(key=lambda x: x["score"], reverse=True)
    return cves


def _envelope(cves, source, fetched_at, stale=False, error=None) -> dict:
    return {
        "cves": cves,
        "count": len(cves),
        "source": source,
        "stale": stale,
        "fetched_at": fetched_at,
        "error": error,
    }


# ── Public API ─────────────────────────────────────────────────────────────────
async def get_recent_cves(days: int = 7, keyword: str = "") -> dict:
    """
    Fetch recent CVEs with a resilient fallback chain.
    ALWAYS returns an envelope dict (see module docstring). Never raises.
    """
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    params = {
        "pubStartDate": start_date.strftime("%Y-%m-%dT00:00:00.000"),
        "pubEndDate": end_date.strftime("%Y-%m-%dT23:59:59.000"),
        "resultsPerPage": 20,
    }
    if keyword.strip():
        params["keywordSearch"] = keyword.strip()

    headers = {"apiKey": NVD_API_KEY} if NVD_API_KEY else {}
    cache_path = _cache_path(days, keyword)

    # 1) LIVE
    try:
        timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout, trust_env=True) as client:
            resp = await client.get(NVD_BASE_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        cves = _parse_nvd(data)
        fetched_at = _now_iso()
        _write_cache(cache_path, cves, fetched_at)
        return _envelope(cves, "live", fetched_at)
    except Exception as exc:
        error = _classify_error(exc)

    # 2) CACHE (any age — better stale than broken)
    cached = _read_cache(cache_path)
    if cached and cached.get("cves"):
        return _envelope(cached["cves"], "cached", cached.get("fetched_at", ""),
                         stale=True, error=error)

    # 3) SAMPLE (bundled, works fully offline). Filter by keyword if given.
    sample = _read_sample()
    if keyword.strip():
        kw = keyword.lower().strip()
        sample = [c for c in sample
                  if kw in c.get("description", "").lower()
                  or kw in " ".join(c.get("affected", [])).lower()
                  or kw in c.get("id", "").lower()]
    if sample:
        return _envelope(sample, "sample", "bundled", stale=True, error=error)

    # 4) Nothing available
    return _envelope([], "error", _now_iso(), stale=True, error=error)
