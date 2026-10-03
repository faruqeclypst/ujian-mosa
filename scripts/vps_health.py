#!/usr/bin/env python3
"""
vps_health.py
Lightweight real-time VPS resource metrics collector.
Outputs clean JSON without any external pip dependencies.
"""
import os
import sys
import json
import shutil
import time
import socket
import platform

def get_vps_status():
    # 1. CPU
    load1, load5, load15 = os.getloadavg() if hasattr(os, "getloadavg") else (0, 0, 0)
    cpu_cores = os.cpu_count() or 1
    cpu_percent = min(100.0, round((load1 / cpu_cores) * 100, 1))

    # Instantaneous CPU usage from /proc/stat
    try:
        with open("/proc/stat") as f:
            fields = [float(x) for x in f.readline().strip().split()[1:8]]
            idle1, total1 = fields[3], sum(fields)
        time.sleep(0.08)
        with open("/proc/stat") as f:
            fields = [float(x) for x in f.readline().strip().split()[1:8]]
            idle2, total2 = fields[3], sum(fields)
        idle_delta = idle2 - idle1
        total_delta = total2 - total1
        if total_delta > 0:
            cpu_percent = max(0.0, min(100.0, round((1.0 - (idle_delta / total_delta)) * 100.0, 1)))
    except Exception:
        pass

    # 2. Memory
    mem_total = 0
    mem_avail = 0
    mem_free = 0
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split(":")
                key = parts[0].strip()
                val = int(parts[1].split()[0]) * 1024 # in bytes
                if key == "MemTotal":
                    mem_total = val
                elif key == "MemAvailable":
                    mem_avail = val
                elif key == "MemFree":
                    mem_free = val
    except Exception:
        pass

    mem_used = max(0, mem_total - (mem_avail if mem_avail else mem_free))
    mem_percent = round((mem_used / mem_total) * 100, 1) if mem_total > 0 else 0.0

    # 3. Disk
    disk_total = 0
    disk_used = 0
    disk_free = 0
    disk_percent = 0.0
    try:
        du = shutil.disk_usage("/")
        disk_total = du.total
        disk_used = du.used
        disk_free = du.free
        disk_percent = round((du.used / du.total) * 100, 1) if du.total > 0 else 0.0
    except Exception:
        pass

    # 4. Uptime
    uptime_seconds = 0
    try:
        with open("/proc/uptime") as f:
            uptime_seconds = int(float(f.readline().split()[0]))
    except Exception:
        pass

    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    minutes = (uptime_seconds % 3600) // 60
    uptime_formatted = ""
    if days > 0:
        uptime_formatted += f"{days} hari "
    if hours > 0 or days > 0:
        uptime_formatted += f"{hours} jam "
    uptime_formatted += f"{minutes} menit"

    # 5. OS & Host Info
    hostname = socket.gethostname()
    os_name = "Linux"
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    os_name = line.strip().split("=")[1].strip('"')
                    break
    except Exception:
        os_name = platform.system() + " " + platform.release()

    # 6. Tenant DB size
    tenant_info = {}
    candidate_path = sys.argv[1] if (len(sys.argv) > 1 and sys.argv[1]) else os.getcwd()
    db_file = os.path.join(candidate_path, "pb_data", "data.db")
    if not os.path.exists(db_file):
        db_file = os.path.join(candidate_path, "data.db")
    if os.path.exists(db_file):
        db_size_bytes = os.path.getsize(db_file)
        tenant_info["db_size_bytes"] = db_size_bytes
        tenant_info["db_size_formatted"] = f"{round(db_size_bytes / (1024 * 1024), 2)} MB"
        tenant_info["tenant_slug"] = os.path.basename(os.path.abspath(candidate_path))

    return {
        "status": "healthy" if (cpu_percent < 90 and mem_percent < 90 and disk_percent < 90) else "warning",
        "hostname": hostname,
        "os": os_name,
        "cpu": {
            "cores": cpu_cores,
            "usage_percent": cpu_percent,
            "load_average": [round(load1, 2), round(load5, 2), round(load15, 2)]
        },
        "memory": {
            "total_bytes": mem_total,
            "used_bytes": mem_used,
            "available_bytes": mem_avail,
            "usage_percent": mem_percent,
            "total_formatted": f"{round(mem_total / (1024**3), 2)} GB",
            "used_formatted": f"{round(mem_used / (1024**3), 2)} GB"
        },
        "disk": {
            "total_bytes": disk_total,
            "used_bytes": disk_used,
            "free_bytes": disk_free,
            "usage_percent": disk_percent,
            "total_formatted": f"{round(disk_total / (1024**3), 2)} GB",
            "used_formatted": f"{round(disk_used / (1024**3), 2)} GB",
            "free_formatted": f"{round(disk_free / (1024**3), 2)} GB"
        },
        "uptime": {
            "seconds": uptime_seconds,
            "formatted": uptime_formatted
        },
        "tenant": tenant_info,
        "timestamp": int(time.time())
    }

if __name__ == "__main__":
    data = get_vps_status()
    print(json.dumps(data))
