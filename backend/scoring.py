"""
scoring.py — Deterministic security posture score (0-100) for CyberSentinel AI.

Beginner note:
- This file does NOT scan anything and does NOT call the internet.
- It only does arithmetic on data you already collected with Nmap.
- Because it is a pure function (same input -> same output), it is easy to test.

The score answers ONE honest question:
    "How exposed is the host we just scanned?"
Start at 100 (perfect, nothing exposed). Subtract penalties. Clamp to [0, 100].
"""

# ── Risky services lookup ──────────────────────────────────────────────────────
# Keyed on the nmap "service" name (lowercase). Value = points to subtract per
# open instance. These numbers are intentionally simple so you can tweak them.
RISKY_SERVICES = {
    "telnet":        25,   # cleartext credentials — very dangerous
    "ftp":           15,   # cleartext, anonymous-login risk
    "microsoft-ds":  15,   # SMB (445) — EternalBlue-class, lateral movement
    "netbios-ssn":   15,   # SMB (139)
    "ms-wbt-server": 15,   # RDP (3389) — BlueKeep, brute force
    "rdp":           15,
    "vnc":           12,   # often weak / no auth
    "mysql":          8,   # database exposed to the network
    "postgresql":     8,
    "mongodb":        8,
    "redis":          8,
    "http":           3,   # unencrypted web (context dependent)
    "snmp":           6,   # info leak
    "rpcbind":        6,
}

# Fallback by port number when the service name is missing/unknown.
RISKY_PORTS = {
    23: 25, 21: 15, 445: 15, 139: 15, 3389: 15, 5900: 12,
    3306: 8, 5432: 8, 27017: 8, 6379: 8, 80: 3, 161: 6, 111: 6,
}

# Penalty applied to ANY open port that is not in the tables above.
DEFAULT_OPEN_PORT_PENALTY = 1

# Outdated software we explicitly know is bad. Keyed on (product_lower, version).
# This makes the demo deterministic even with no internet.
OUTDATED_VERSIONS = {
    ("apache httpd", "2.4.49"): "CVE-2021-41773 path traversal / RCE",
    ("apache httpd", "2.4.50"): "CVE-2021-42013 path traversal / RCE",
    ("vsftpd", "2.3.4"):        "Backdoor (CVE-2011-2523)",
    ("openssl", "1.0.1"):       "Heartbleed-era (CVE-2014-0160)",
}
OUTDATED_PENALTY = 12

# CVE penalty by severity (only for CVEs correlated to a scanned product).
CVE_PENALTY = {
    "CRITICAL": 20,
    "HIGH":     12,
    "MEDIUM":    6,
    "LOW":       2,
    "UNKNOWN":   1,
}


def _service_penalty(port_info: dict) -> int:
    """Penalty for a single open port, based on its service name then port number."""
    service = (port_info.get("service") or "").lower().strip()
    if service in RISKY_SERVICES:
        return RISKY_SERVICES[service]
    port = port_info.get("port")
    if port in RISKY_PORTS:
        return RISKY_PORTS[port]
    return DEFAULT_OPEN_PORT_PENALTY


def _cve_correlates(cve: dict, products: list[str]) -> bool:
    """True if a CVE seems related to one of the products found on the host.
    Simple heuristic (not full CPE matching): does a product token appear in the
    CVE description or its 'affected' list? Good enough for a student demo."""
    haystack = (cve.get("description", "") + " " + " ".join(cve.get("affected", []))).lower()
    for product in products:
        token = product.lower().split()[0] if product else ""
        if token and len(token) >= 3 and token in haystack:
            return True
    return False


def risk_level_from_score(score) -> str:
    """Map a 0-100 score to a risk label. None -> Unknown."""
    if score is None:
        return "Unknown"
    if score >= 80:
        return "Low"
    if score >= 60:
        return "Medium"
    if score >= 40:
        return "High"
    return "Critical"


def compute_security_score(scan_results: dict, cves: list[dict] | None = None) -> dict:
    """
    Compute the host posture score from an Nmap scan result.

    Args:
        scan_results: dict returned by scanner.scan_target().
        cves: optional list of CVE dicts (from cve_feed) to correlate. During a
              live scan we pass [] so we never wait on the network.

    Returns:
        {
          "score": int 0-100  OR None if the scan errored,
          "risk_level": "Low"|"Medium"|"High"|"Critical"|"Unknown",
          "breakdown": [ {"reason": str, "points": int}, ... ],
          "open_ports": int,
          "host_count": int,
        }
    """
    cves = cves or []

    # Guard 1: scanner itself failed -> we cannot honestly score. Return None.
    if not scan_results or scan_results.get("error"):
        return {"score": None, "risk_level": "Unknown", "breakdown": [],
                "open_ports": 0, "host_count": 0}

    score = 100
    breakdown: list[dict] = []
    open_ports = 0
    products: list[str] = []
    hosts = scan_results.get("hosts", [])

    # ── Walk every open port on every host ────────────────────────────────────
    for host in hosts:
        for proto in host.get("protocols", []):
            for p in proto.get("ports", []):
                if p.get("state") != "open":
                    continue
                open_ports += 1

                # Service / port penalty
                pen = _service_penalty(p)
                score -= pen
                svc = p.get("service") or f"port {p.get('port')}"
                breakdown.append({"reason": f"Open {svc} ({p.get('port')})", "points": -pen})

                # Track product for CVE correlation + outdated check
                product = (p.get("product") or "").strip()
                version = (p.get("version") or "").strip()
                if product:
                    products.append(product)

                # Outdated software penalty
                key = (product.lower(), version)
                if key in OUTDATED_VERSIONS:
                    score -= OUTDATED_PENALTY
                    breakdown.append({
                        "reason": f"Outdated {product} {version} — {OUTDATED_VERSIONS[key]}",
                        "points": -OUTDATED_PENALTY,
                    })

    # ── Correlated CVE penalties ──────────────────────────────────────────────
    for cve in cves:
        if cve.get("id") in (None, "", "ERROR"):
            continue
        if _cve_correlates(cve, products):
            sev = (cve.get("severity") or "UNKNOWN").upper()
            pen = CVE_PENALTY.get(sev, 1)
            score -= pen
            breakdown.append({"reason": f"{cve['id']} ({sev}) affects scanned software",
                              "points": -pen})

    # ── Surface penalty (mild, capped) ────────────────────────────────────────
    surface = min(10, max(0, open_ports - 3))
    if surface:
        score -= surface
        breakdown.append({"reason": f"Large attack surface ({open_ports} open ports)",
                          "points": -surface})

    # Empty/good host: nothing open
    if open_ports == 0:
        breakdown.append({"reason": "No open ports detected", "points": 0})

    score = max(0, min(100, score))
    return {
        "score": score,
        "risk_level": risk_level_from_score(score),
        "breakdown": breakdown,
        "open_ports": open_ports,
        "host_count": len(hosts),
    }
