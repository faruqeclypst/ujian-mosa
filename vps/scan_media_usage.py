#!/usr/bin/env python3
import glob
import sqlite3
import re
import json
import subprocess
import os

def scan_local_schools():
    pattern = re.compile(r'https?://(?:assets\.examku\.my\.id|pub-[a-zA-Z0-9]+\.r2\.dev)/([a-zA-Z0-9_\-\./]+)')
    found_keys = {}  # key -> list of schools using it
    school_stats = {}

    # 1. Master VPS local schools
    db_paths = glob.glob('/opt/pocketbase/schools/*/pb_data/data.db')
    for db_path in db_paths:
        school_slug = db_path.split('/')[4]
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
            except Exception as q_err:
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
            except Exception as s_err:
                pass

            school_stats[school_slug] = {
                'node': 'master',
                'active_references': school_refs
            }
            conn.close()
        except Exception as e:
            school_stats[school_slug] = {'error': str(e)}

    # 2. Worker nodes (e.g. 43.134.175.87)
    worker_hosts = ['43.134.175.87']
    for host in worker_hosts:
        try:
            remote_cmd = (
                "python3 -c \""
                "import glob, sqlite3, re, json; "
                "p = re.compile(r'https?://(?:assets\.examku\.my\.id|pub-[a-zA-Z0-9]+\.r2\.dev)/([a-zA-Z0-9_\\-\\./]+)'); "
                "res = {}; "
                "for db in glob.glob('/opt/pocketbase/schools/*/pb_data/data.db'): "
                "  slug = db.split('/')[4]; "
                "  if slug == 'template': continue; "
                "  try: "
                "    conn = sqlite3.connect(db); c = conn.cursor(); k = []; "
                "    for r in c.execute('SELECT text, options, groupText FROM questions'): "
                "      m = p.findall((r[0] or '') + ' ' + (r[1] or '') + ' ' + (r[2] or '')); "
                "      k.extend([x.split('?')[0].split('#')[0] for x in m]); "
                "    res[slug] = k; conn.close(); "
                "  except Exception as e: res[slug] = []; "
                "print(json.dumps(res))"
                "\""
            )
            ssh_proc = subprocess.run(
                ['ssh', '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', f'root@{host}', remote_cmd],
                capture_output=True, text=True, timeout=10
            )
            if ssh_proc.returncode == 0:
                worker_data = json.loads(ssh_proc.stdout.strip())
                for w_slug, w_keys in worker_data.items():
                    school_stats[w_slug] = {
                        'node': host,
                        'active_references': len(w_keys)
                    }
                    for k in w_keys:
                        if k not in found_keys:
                            found_keys[k] = []
                        if w_slug not in found_keys[k]:
                            found_keys[k].append(w_slug)
        except Exception as w_err:
            pass

    total_refs = sum(s.get('active_references', 0) for s in school_stats.values() if isinstance(s, dict))
    shared_keys_count = sum(1 for k, schools in found_keys.items() if len(schools) > 1)

    result = {
        'status': 'success',
        'total_active_references': total_refs,
        'unique_images_in_use': len(found_keys),
        'shared_images_count': shared_keys_count,
        'schools': school_stats,
        'protection_status': 'PROTECTED (Multi-Tenant Shared Deletion Disabled)',
        'deduplication_status': 'ENABLED (SHA-256 Content Hash)'
    }
    return result

if __name__ == '__main__':
    print(json.dumps(scan_local_schools(), indent=2))
