#!/usr/bin/env python3
"""
master_infra_audit.py
Aggregates health and resource metrics from Master VPS and all Worker VPS nodes.
Outputs comprehensive JSON for SuperAdmin.
"""
import os
import sys
import json
import sqlite3
import subprocess
import time

def run_local_health(tenant_dir=""):
    try:
        cmd = ["/usr/local/bin/vps-health.py"]
        if tenant_dir:
            cmd.append(tenant_dir)
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            return json.loads(res.stdout.strip())
    except Exception as e:
        return {"status": "error", "error": str(e)}
    return {"status": "error", "error": "Non-zero exit"}

def run_remote_health(host, tenant_dir=""):
    try:
        remote_cmd = "/usr/local/bin/vps-health.py"
        if tenant_dir:
            remote_cmd += f" {tenant_dir}"
        cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=3", f"root@{host}", remote_cmd]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            return json.loads(res.stdout.strip())
    except Exception as e:
        return {"status": "offline", "error": str(e)}
    return {"status": "offline", "error": "Gagal terhubung via SSH"}

def audit_infrastructure():
    master_db_path = "/opt/pocketbase/master/pb_data/data.db"
    schools = []
    unique_workers = set()

    if os.path.exists(master_db_path):
        try:
            conn = sqlite3.connect(master_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, slug, pb_url, server_host, port, is_active, plan, student_quota FROM schools ORDER BY created DESC")
            rows = cursor.fetchall()
            for r in rows:
                s_dict = dict(r)
                shost = s_dict.get("server_host") or "127.0.0.1"
                schools.append(s_dict)
                if shost not in ("127.0.0.1", "localhost", "::1", ""):
                    unique_workers.add(shost)
            conn.close()
        except Exception as e:
            print(json.dumps({"error": f"Gagal membaca master database: {e}"}))
            sys.exit(1)

    # 1. Master Node Health
    master_metrics = run_local_health()
    master_node = {
        "id": "master-singapore",
        "name": "Master Node (Singapura)",
        "ip": "64.235.41.108",
        "is_master": True,
        "metrics": master_metrics
    }

    # 2. Worker Nodes Health
    worker_nodes = []
    worker_metrics_cache = {}
    for idx, whost in enumerate(sorted(unique_workers), 1):
        w_metrics = run_remote_health(whost)
        worker_metrics_cache[whost] = w_metrics
        worker_nodes.append({
            "id": f"worker-{idx}",
            "name": f"Worker Node {idx} ({whost})",
            "ip": whost,
            "is_master": False,
            "metrics": w_metrics
        })

    # 3. Enrich schools with DB sizes & node assignment
    for s in schools:
        shost = s.get("server_host") or "127.0.0.1"
        slug = s.get("slug")
        is_local = shost in ("127.0.0.1", "localhost", "::1", "")
        s["is_local"] = is_local
        s["node_ip"] = "64.235.41.108" if is_local else shost

        # Check DB file
        db_size_formatted = "0 MB"
        db_size_bytes = 0
        if is_local:
            local_db = f"/opt/pocketbase/schools/{slug}/pb_data/data.db"
            if os.path.exists(local_db):
                db_size_bytes = os.path.getsize(local_db)
                db_size_formatted = f"{round(db_size_bytes / (1024 * 1024), 2)} MB"
        else:
            try:
                cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=2", f"root@{shost}", f"stat -c %s /opt/pocketbase/schools/{slug}/pb_data/data.db 2>/dev/null || echo 0"]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
                if res.returncode == 0:
                    val = int(res.stdout.strip().split()[0])
                    if val > 0:
                        db_size_bytes = val
                        db_size_formatted = f"{round(db_size_bytes / (1024 * 1024), 2)} MB"
            except Exception:
                pass
        s["db_size_formatted"] = db_size_formatted
        s["db_size_bytes"] = db_size_bytes

    all_nodes = [master_node] + worker_nodes
    online_nodes = sum(1 for n in all_nodes if n.get("metrics", {}).get("status") in ("healthy", "warning"))

    result = {
        "timestamp": int(time.time()),
        "summary": {
            "total_nodes": len(all_nodes),
            "online_nodes": online_nodes,
            "total_tenants": len(schools),
            "active_tenants": sum(1 for s in schools if s.get("is_active"))
        },
        "nodes": all_nodes,
        "schools": schools
    }

    print(json.dumps(result))

if __name__ == "__main__":
    audit_infrastructure()
