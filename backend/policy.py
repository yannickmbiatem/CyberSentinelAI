"""
policy.py — authorization policy for CyberSentinel AI scans.

This is the "authorization-first" core. Every scan target passes through
classify_target() before anything touches the network.

Defence summary (memorize for the jury):
  - Private/loopback targets are safe by default (packets never leave your LAN).
  - Public targets REQUIRE explicit consent, UNLESS the owner published standing
    authorization (allowlist of known safe demo targets).
  - Reserved / cloud-metadata ranges are ALWAYS refused — no override possible.
  - Unauthorized scanning is a criminal offence under Cameroon Law No. 2010/012
    (Cybersecurity and Cybercriminality) and equivalents worldwide.

No external dependencies — stdlib only (ipaddress, urllib.parse).
"""
import ipaddress
from urllib.parse import urlparse

# ── Allowlist: targets whose owners PUBLISHED standing authorization to scan ────
# These are legal to scan because the owner consented publicly. Cite each in the
# dissertation. Add the student's own deployed domain here by name.
AUTHORIZED_TARGETS = {
    "localhost",
    "scanme.nmap.org",          # Nmap project: explicitly authorizes light scanning
    "testphp.vulnweb.com",      # Acunetix: deliberately vulnerable demo web app
    "testhtml5.vulnweb.com",    # Acunetix demo
    "testasp.vulnweb.com",      # Acunetix demo
    "demo.testfire.net",        # IBM AltoroMutual deliberately vulnerable bank demo
    "badssl.com",               # designed for TLS/cert testing
    "juice-shop.herokuapp.com", # OWASP Juice Shop public demo (when reachable)
}


def _host_of(target: str) -> str:
    """Extract a bare host from an IP, a hostname, or a full URL."""
    t = (target or "").strip()
    if t.lower().startswith(("http://", "https://")):
        return urlparse(t).hostname or t
    # Allow 'host:port' or 'host/path' forms too.
    if "/" in t:
        t = t.split("/", 1)[0]
    if t.count(":") == 1 and not _looks_ipv6(t):
        t = t.split(":", 1)[0]
    return t


def _looks_ipv6(t: str) -> bool:
    return t.count(":") >= 2


def is_forbidden_ip(ip) -> bool:
    """Ranges we ALWAYS refuse, even with authorized=true. Non-negotiable.
    Loopback is handled separately (it is ALLOWED)."""
    if ip.is_loopback:
        return False
    if ip.is_multicast or ip.is_reserved or ip.is_link_local or ip.is_unspecified:
        return True
    # Cloud metadata endpoint (SSRF footgun) + its link-local block.
    try:
        if ip in ipaddress.ip_network("169.254.0.0/16"):
            return True
        if ip in ipaddress.ip_network("0.0.0.0/8"):
            return True
    except Exception:
        pass
    return False


def classify_target(target: str) -> dict:
    """
    Classify a scan target into one of:
      private | loopback | allowlisted_public | public | forbidden | invalid

    Returns:
      {kind, host, requires_consent, allowlisted, reason}
    """
    host = _host_of(target)
    if not host:
        return {"kind": "invalid", "host": "", "requires_consent": True,
                "allowlisted": False, "reason": "Empty or invalid target."}

    # Owner-published authorization wins immediately.
    if host.lower() in AUTHORIZED_TARGETS:
        return {"kind": "allowlisted_public", "host": host,
                "requires_consent": False, "allowlisted": True,
                "reason": "Owner-published authorization (safe demo target)."}

    # Is it an IP literal?
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        # A hostname/domain we don't recognize -> treat as public, needs consent.
        return {"kind": "public", "host": host, "requires_consent": True,
                "allowlisted": False, "reason": "Public hostname; authorization required."}

    if is_forbidden_ip(ip):
        return {"kind": "forbidden", "host": host, "requires_consent": True,
                "allowlisted": False,
                "reason": "Reserved / cloud-metadata / link-local range — never scannable."}
    if ip.is_loopback:
        return {"kind": "loopback", "host": host, "requires_consent": False,
                "allowlisted": False, "reason": "Loopback (your own machine)."}
    if ip.is_private:
        return {"kind": "private", "host": host, "requires_consent": False,
                "allowlisted": False, "reason": "Private LAN address (RFC 1918)."}

    return {"kind": "public", "host": host, "requires_consent": True,
            "allowlisted": False, "reason": "Public IP address; authorization required."}


# Rate-limit budgets (enforced via the audit log in db.py).
MAX_SCANS_PER_MIN = 5
MAX_WEB_SCANS_PER_MIN = 3


def is_rate_limited(scan_type: str = "network") -> bool:
    """Return True if the rate limit for this scan type has been exceeded."""
    try:
        from db import count_recent_scans
        max_allowed = MAX_WEB_SCANS_PER_MIN if scan_type == "web" else MAX_SCANS_PER_MIN
        recent = count_recent_scans(window_seconds=60, scan_type=scan_type)
        return recent >= max_allowed
    except Exception:
        return False  # If DB is unavailable, don't block the scan
