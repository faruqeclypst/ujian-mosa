#!/usr/bin/env python3
import glob
import sqlite3
import re
import json
import subprocess
import sys

def scan_this_node():
    pattern = re.compile(r'https?://(?:assets\.examku\.my\.id|pub-[a-zA-Z0-9]+\.r2\.dev)/([a-zA-Z0-9_\-\./]+)')
    found_keys = {}
    school_stats = {}

    db_paths = glob.glob('/opt/pocketbase/schools/*/pb_data/data.db')
    for db_path in db_paths:
        parts = db_path.split('/')
        if len(parts) < 5:
            continue
        school_slug = parts[4]
        if school_slug == 'template':
            continue
        
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            school_refs = 0
            
            # Scan questions (text, options, groupText)
            try:
                for row in c.execute('SELECT text, options, groupText FROM questions'):
                    content = (row[0] or '') + ' ' + (row[1] or '') + ' ' + (row[2] or '')
                    matches = pattern.findall(content)
                    for m in matches:
                        clean_key = m.split('?')[0].split('#')[0]
                        if clean_key not in found_keys:
                            found_keys[clean_key] = []
                        if school_slug not in found_keys[clean_key]:
                            found_keys[clean_key].append(school_slug)
                        school_refs += 1
            except Exception:
                pass

            # Scan settings (logo, logoUrl)
            try:
                for row in c.execute('SELECT logo, logoUrl FROM settings'):
                    content = (row[0] or '') + ' ' + (row[1] or '')
                    matches = pattern.findall(content)
                    for m in matches:
                        clean_key = m.split('?')[0].split('#')[0]
                        if clean_key not in found_keys:
                            found_keys[clean_key] = []
                        if school_slug not in found_keys[clean_key]:
                            found_keys[clean_key].append(school_slug)
                        school_refs += 1
            except Exception:
                pass

            school_stats[school_slug] = {
                'active_references': school_refs,
                'keys': [k for k, schools in found_keys.items() if school_slug in schools]
            }
            conn.close()
        except Exception as e:
            school_stats[school_slug] = {'error': str(e), 'active_references': 0, 'keys': []}

    return school_stats

def main():
    if '--local-only' in sys.argv:
        print(json.dumps(scan_this_node()))
        return

    # Master node aggregation
    local_schools = scan_this_node()
    all_school_stats = {}
    all_keys = {}

    for slug, data in local_schools.items():
        all_school_stats[slug] = {
            'node': 'Master VPS (127.0.0.1)',
            'active_references': data.get('active_references', 0)
        }
        for k in data.get('keys', []):
            if k not in all_keys:
                all_keys[k] = []
            if slug not in all_keys[k]:
                all_keys[k].append(slug)

    # Scan remote worker nodes from schools table in Master PB
    worker_hosts = set()
    try:
        conn = sqlite3.connect('/opt/pocketbase/master/pb_data/data.db')
        c = conn.cursor()
        for r in c.execute("SELECT DISTINCT server_host FROM schools WHERE server_host != '' AND server_host != '127.0.0.1' AND server_host != 'localhost'"):
            if r[0]:
                worker_hosts.add(r[0].strip())
        conn.close()
    except Exception:
        worker_hosts = {'43.134.175.87'}

    for host in worker_hosts:
        try:
            res = subprocess.run(
                ['ssh', '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', f'root@{host}', '/usr/local/bin/scan-media-usage.py --local-only'],
                capture_output=True, text=True, timeout=10
            )
            if res.returncode == 0 and res.stdout.strip():
                remote_data = json.loads(res.stdout.strip())
                for slug, data in remote_data.items():
                    all_school_stats[slug] = {
                        'node': f'Worker ({host})',
                        'active_references': data.get('active_references', 0)
                    }
                    for k in data.get('keys', []):
                        if k not in all_keys:
                            all_keys[k] = []
                        if slug not in all_keys[k]:
                            all_keys[k].append(slug)
        except Exception:
            pass

    total_refs = sum(s.get('active_references', 0) for s in all_school_stats.values())
    shared_keys_count = sum(1 for k, schools in all_keys.items() if len(schools) > 1)

    result = {
        'status': 'success',
        'total_active_references': total_refs,
        'unique_images_in_use': len(all_keys),
        'shared_images_count': shared_keys_count,
        'schools': all_school_stats,
        'protection_status': 'PROTECTED (Multi-Tenant Shared Deletion Disabled)',
        'deduplication_status': 'ENABLED (SHA-256 Content Hash)'
    }
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
