"""
test_scoring.py — proves the security score is real and reproducible.

Run it:
    cd backend
    .\\venv\\Scripts\\activate
    python -m pytest test_scoring.py -v
    (or simply:  python test_scoring.py )

No Nmap and no internet needed — we feed hand-written fake scan results.
"""
from scoring import compute_security_score


# ── Fixture 1: a clean host (nothing open) -> perfect score ───────────────────
CLEAN_SCAN = {
    "target": "127.0.0.1",
    "ports_scanned": "1-1024",
    "hosts": [
        {"address": "127.0.0.1", "hostname": "localhost", "state": "up",
         "os_guess": "", "protocols": []}
    ],
    "total_hosts": 1,
}

# ── Fixture 2: a deliberately vulnerable host -> low score ────────────────────
# telnet (23) open + Apache httpd 2.4.49 on http (80) + 2 correlated HIGH CVEs.
VULN_SCAN = {
    "target": "192.168.1.50",
    "ports_scanned": "1-1024",
    "hosts": [
        {
            "address": "192.168.1.50", "hostname": "vuln-box", "state": "up",
            "os_guess": "Linux 5.x",
            "protocols": [
                {"protocol": "tcp", "ports": [
                    {"port": 23, "protocol": "tcp", "state": "open",
                     "service": "telnet", "product": "Linux telnetd", "version": ""},
                    {"port": 80, "protocol": "tcp", "state": "open",
                     "service": "http", "product": "Apache httpd", "version": "2.4.49"},
                ]},
            ],
        }
    ],
    "total_hosts": 1,
}

VULN_CVES = [
    {"id": "CVE-2021-41773", "severity": "HIGH", "score": 7.5,
     "description": "Apache HTTP Server 2.4.49 path traversal", "affected": ["apache http_server"]},
    {"id": "CVE-2021-42013", "severity": "HIGH", "score": 9.8,
     "description": "Apache HTTP Server 2.4.50 path traversal and RCE", "affected": ["apache http_server"]},
]


def test_clean_host_scores_100():
    result = compute_security_score(CLEAN_SCAN, cves=[])
    assert result["score"] == 100
    assert result["risk_level"] == "Low"
    assert result["open_ports"] == 0


def test_vulnerable_host_scores_36():
    # 100 - 25 (telnet) - 3 (http) - 12 (outdated apache) - 12 - 12 (2 HIGH CVEs) = 36
    result = compute_security_score(VULN_SCAN, cves=VULN_CVES)
    assert result["score"] == 36, f"expected 36, got {result['score']}: {result['breakdown']}"
    assert result["risk_level"] == "Critical"
    assert result["open_ports"] == 2


def test_scanner_error_returns_none():
    result = compute_security_score({"error": "nmap failed", "hosts": []}, cves=[])
    assert result["score"] is None
    assert result["risk_level"] == "Unknown"


if __name__ == "__main__":
    # Allow running without pytest installed.
    test_clean_host_scores_100()
    test_vulnerable_host_scores_36()
    test_scanner_error_returns_none()
    print("OK: all scoring tests passed (clean=100, vuln=36, error=None).")
