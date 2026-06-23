"""
seed_demo.py — load a canned vulnerable scan into the database so the Dashboard
shows a real LOW score with zero infrastructure (great for the jury demo).

Run it:
    cd backend
    .\\venv\\Scripts\\activate
    python seed_demo.py

Then open the Dashboard — the Security Score reflects this vulnerable host.
To get back to a clean state, delete cybersentinel.db and re-scan 127.0.0.1.
"""
import json
import os
from scoring import compute_security_score
from db import save_scan

HERE = os.path.dirname(__file__)
SCAN_PATH = os.path.join(HERE, "sample_vuln_scan.json")


def main():
    with open(SCAN_PATH, "r", encoding="utf-8") as f:
        scan_results = json.load(f)

    # Same path as a real /api/scan (no network -> cves=[]).
    sc = compute_security_score(scan_results, cves=[])

    scan_id = save_scan(
        scan_results["target"], scan_results, sc["score"], sc["risk_level"],
        sc["breakdown"], sc["open_ports"], sc["host_count"],
    )

    print(f"OK: seeded vulnerable scan #{scan_id}")
    print(f"  Target:     {scan_results['target']}")
    print(f"  Score:      {sc['score']}/100  ({sc['risk_level']})")
    print(f"  Open ports: {sc['open_ports']}")
    print("  Why:")
    for b in sc["breakdown"]:
        print(f"    {b['points']:>4}  {b['reason']}")


if __name__ == "__main__":
    main()
