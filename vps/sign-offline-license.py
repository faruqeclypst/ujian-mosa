#!/usr/bin/env python3
import sys
import json
import base64
import subprocess
from datetime import datetime

def main():
    if len(sys.argv) >= 5:
        # Positional arguments: school_name, slug, npsn, valid_until, [max_students], [notes]
        school_name = sys.argv[1]
        slug = sys.argv[2]
        npsn = sys.argv[3]
        valid_until = sys.argv[4]
        max_students = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else 0
        notes = sys.argv[6] if len(sys.argv) > 6 else "Izin Resmi Server Offline CBT"

        data = {
            "school_name": school_name,
            "slug": slug,
            "npsn": npsn if npsn and npsn != "-" else None,
            "valid_until": valid_until,
            "max_students": max_students,
            "issued_at": datetime.utcnow().isoformat() + "Z",
            "notes": notes
        }
    else:
        raw_input = sys.stdin.read()
        try:
            data = json.loads(raw_input)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"JSON parse error: {e}"}))
            sys.exit(1)

    payload_json = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    b64_payload = base64.b64encode(payload_json.encode('utf-8')).decode('utf-8')

    key_path = "/opt/pocketbase/master/license_private_key.pem"
    
    # Sign using openssl dgst
    proc = subprocess.Popen(
        ["openssl", "dgst", "-sha256", "-sign", key_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    sig_bytes, err = proc.communicate(input=b64_payload.encode('utf-8'))
    
    if proc.returncode != 0:
        print(json.dumps({"success": False, "error": f"OpenSSL sign error: {err.decode('utf-8')}"}))
        sys.exit(1)

    # Base64url encode signature
    b64_sig = base64.urlsafe_b64encode(sig_bytes).decode('utf-8').rstrip('=')
    license_code = f"EXAMKU-OFFLINE.v2.{b64_payload}.{b64_sig}"

    print(json.dumps({
        "success": True,
        "license": license_code,
        "payload": data
    }))

if __name__ == "__main__":
    main()
