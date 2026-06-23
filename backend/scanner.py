"""
scanner.py — network scanning for CyberSentinel AI.

Two engines, automatic fallback:
  1. NMAP (preferred) — needs the real `nmap` program installed (https://nmap.org/download).
     Gives service + version detection (-sV).
  2. SOCKET fallback (pure Python) — used when nmap is NOT installed. Detects open
     TCP ports with the standard library only. Less detail (no version), but always works.

Both engines return the SAME dict shape so scoring, AI analysis and persistence
work the same way regardless of which one ran.

WARNING: Only scan systems you OWN or have WRITTEN permission to test.
Unauthorized scanning is illegal in most countries.
"""
import socket
from concurrent.futures import ThreadPoolExecutor


def _empty_result(target, ports, extra=None):
    base = {
        "target": target,
        "ports_scanned": ports,
        "hosts": [],
        "scan_info": {},
        "total_hosts": 0,
        "engine": "none",
    }
    if extra:
        base.update(extra)
    return base


# ── Port spec parsing ──────────────────────────────────────────────────────────
def _parse_ports(ports: str) -> list[int]:
    """Turn '1-1024' or '80,443,8080' or '22,80,1000-1010' into a sorted port list."""
    result = set()
    for part in str(ports).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            try:
                a, b = part.split("-", 1)
                a, b = int(a), int(b)
                result.update(range(max(1, a), min(65535, b) + 1))
            except ValueError:
                continue
        else:
            try:
                p = int(part)
                if 1 <= p <= 65535:
                    result.add(p)
            except ValueError:
                continue
    return sorted(result)


# ── Engine 1: nmap ─────────────────────────────────────────────────────────────
def _nmap_available() -> bool:
    try:
        import nmap
        nmap.PortScanner()   # raises PortScannerError if the binary is missing
        return True
    except Exception:
        return False


def _scan_with_nmap(target: str, ports: str) -> dict:
    import nmap
    nm = nmap.PortScanner()
    nm.scan(hosts=target, arguments=f"-sV -sC -p {ports} --open -T4")

    results = {
        "target": target,
        "ports_scanned": ports,
        "hosts": [],
        "scan_info": nm.scaninfo(),
        "total_hosts": len(nm.all_hosts()),
        "engine": "nmap",
    }

    for host in nm.all_hosts():
        host_data = {
            "address": host,
            "hostname": nm[host].hostname() or "N/A",
            "state": nm[host].state(),
            "os_guess": "",
            "protocols": [],
        }
        try:
            if "osmatch" in nm[host] and nm[host]["osmatch"]:
                host_data["os_guess"] = nm[host]["osmatch"][0]["name"]
        except Exception:
            pass

        for proto in nm[host].all_protocols():
            ports_list = []
            for port in sorted(nm[host][proto].keys()):
                p = nm[host][proto][port]
                ports_list.append({
                    "port": port,
                    "protocol": proto,
                    "state": p.get("state", "unknown"),
                    "service": p.get("name", ""),
                    "product": p.get("product", ""),
                    "version": p.get("version", ""),
                    "extrainfo": p.get("extrainfo", ""),
                    "cpe": p.get("cpe", ""),
                })
            host_data["protocols"].append({"protocol": proto, "ports": ports_list})
        results["hosts"].append(host_data)

    return results


# ── Engine 2: pure-Python socket scan (fallback) ───────────────────────────────
def _check_port(target: str, port: int, timeout: float = 0.5):
    """Return the port number if open, else None."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            if s.connect_ex((target, port)) == 0:
                return port
    except Exception:
        pass
    return None


def _service_name(port: int) -> str:
    """Best-effort service name from the OS services table (no version)."""
    try:
        return socket.getservbyport(port, "tcp")
    except Exception:
        return ""


def _scan_with_sockets(target: str, ports: str) -> dict:
    port_list = _parse_ports(ports)
    if not port_list:
        return _empty_result(target, ports, {"engine": "socket"})

    # Resolve hostname (and confirm host is reachable enough to resolve).
    try:
        ip = socket.gethostbyname(target)
    except Exception:
        ip = target

    open_ports = []
    # Thread pool — scanning 1024 ports one by one would be slow.
    with ThreadPoolExecutor(max_workers=100) as pool:
        for result in pool.map(lambda p: _check_port(ip, p), port_list):
            if result is not None:
                open_ports.append(result)

    open_ports.sort()
    ports_data = [{
        "port": p,
        "protocol": "tcp",
        "state": "open",
        "service": _service_name(p),
        "product": "",
        "version": "",
        "extrainfo": "",
        "cpe": "",
    } for p in open_ports]

    host_data = {
        "address": ip,
        "hostname": target if target != ip else "N/A",
        "state": "up",
        "os_guess": "",
        "protocols": [{"protocol": "tcp", "ports": ports_data}],
    }

    return {
        "target": target,
        "ports_scanned": ports,
        "hosts": [host_data],
        "scan_info": {"method": "tcp connect (python socket fallback)"},
        "total_hosts": 1,
        "engine": "socket",
        "note": "Nmap not installed — used built-in TCP scanner (no version detection). "
                "Install Nmap (https://nmap.org/download) for service/version detail.",
    }


# ── Web Vulnerability Scan (Nikto) — passive trigger from network scan ──────────
def _run_nikto(target: str) -> str:
    """
    Quick Nikto pass triggered when a network scan finds open web ports.
    Uses the nikto_scanner module for path discovery and proper execution.
    Returns a plain-text summary (raw lines) for the AI analysis prompt.
    """
    try:
        from nikto_scanner import find_nikto, find_perl, parse_nikto_output
        import subprocess

        nikto_path = find_nikto()
        if not nikto_path:
            return "Nikto not found — install it at <project>/nikto/program/nikto.pl or system PATH."

        if nikto_path.endswith(".pl"):
            perl = find_perl()
            cmd = [perl, nikto_path, "-h", target, "-maxtime", "45s", "-nointeractive", "-Format", "txt"]
        else:
            cmd = [nikto_path, "-h", target, "-maxtime", "45s", "-nointeractive", "-Format", "txt"]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60,
                                encoding="utf-8", errors="replace")

        findings = parse_nikto_output(result.stdout)
        if findings:
            # Return as readable lines for AI context — limit to 30 most severe
            lines = [f"[{f['severity']}] {f['description']}" for f in findings[:30]]
            return "\n".join(lines)
        return "No specific web vulnerabilities found by Nikto (or server not responding on web port)."
    except Exception as e:
        return f"Nikto execution error: {e}"


# ── Public entry point ─────────────────────────────────────────────────────────
def scan_target(target: str, ports: str = "1-1024") -> dict:
    """
    Scan a target. Uses nmap if available, otherwise a pure-Python socket scan.
    Always returns a dict (never raises). On total failure returns {"error": ...}.
    """
    res = None
    if _nmap_available():
        try:
            res = _scan_with_nmap(target, ports)
        except Exception as e:
            try:
                res = _scan_with_sockets(target, ports)
                res["note"] = f"Nmap scan failed ({e}); used socket fallback."
            except Exception as e2:
                res = _empty_result(target, ports, {"error": f"Scan failed: {e2}"})
    else:
        try:
            res = _scan_with_sockets(target, ports)
        except Exception as e:
            res = _empty_result(target, ports, {"error": f"Scan failed: {e}"})

    # If the scan was successful, check if any web ports are open to trigger quick Nikto pass
    if res and not res.get("error"):
        has_web = False
        web_port = 80
        for host in res.get("hosts", []):
            for proto in host.get("protocols", []):
                for p_info in proto.get("ports", []):
                    if p_info.get("port") in [80, 443, 8080, 8443] and p_info.get("state") == "open":
                        has_web = True
                        web_port = p_info.get("port")
                        break

        if has_web:
            res["web_vulnerabilities"] = _run_nikto(target)
            res["web_port"] = web_port

    return res
