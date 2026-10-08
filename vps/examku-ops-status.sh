#!/bin/bash
# ============================================================
# EXAMKU OPS STATUS — ringkasan JSON operasional backup & fallback
# Dipakai oleh endpoint /api/multi-vps/ops-status (superadmin).
# ============================================================
python3 - << 'PYEOF'
import json, subprocess, os, glob

def run(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15).stdout
    except Exception:
        return ""

def tail(path, n=20):
    try:
        with open(path) as f:
            return f.readlines()[-n:]
    except Exception:
        return []

def last_summary(lines):
    for l in reversed(lines):
        if "SELESAI:" in l:
            return l.strip()
    return ""

def last_time(lines):
    # ambil timestamp "[2026-10-08 10:42:05]" dari baris terakhir
    for l in reversed(lines):
        l = l.strip()
        if l.startswith("[") and "]" in l:
            return l[1:l.index("]")]
    return "-"

crons = [l for l in run("crontab -l 2>/dev/null").splitlines() if "examku-" in l]

snaps = []
base = "/opt/pocketbase/worker-snapshots"
if os.path.isdir(base):
    for slug in sorted(os.listdir(base)):
        d = os.path.join(base, slug)
        if not os.path.isdir(d):
            continue
        files = sorted(glob.glob(os.path.join(d, "*.db")))
        total = sum(os.path.getsize(f) for f in files)
        latest = os.path.basename(files[-1])[:-3] if files else "-"
        snaps.append({"slug": slug, "count": len(files), "latest": latest,
                      "total_mb": round(total / 1048576, 1)})

def job_block(log_path):
    lines = tail(log_path, 25)
    return {
        "last_run": last_time(lines),
        "summary": last_summary(tail(log_path, 60)),
        "log": [l.rstrip("\n") for l in lines],
    }

print(json.dumps({
    "crons": crons,
    "backup": job_block("/var/log/examku-backup-workers.log"),
    "fallback": job_block("/var/log/examku-auto-fallback.log"),
    "snapshots": snaps,
}))
PYEOF
