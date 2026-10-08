import subprocess

env_content = """PORT=8787
SUMOPOD_API_URL=https://api-pay.sumopod.com/api/v1
SUMOPOD_API_KEY=c3b48f9dbd2c235efa65e99e95cbb4b925088994dba1c58283b0ad6cdc105455
SUMOPOD_WEBHOOK_TOKEN=whtok_ff9a583f7bc3beca4ea2afb6345627d14d4424064002cb55476b5ae413b96b05
SUMOPOD_WEBHOOK_SECRET=whsec_tlDfMd2tcJ/ZhpYzQOYy6aEE6F/E0MNN
MASTER_PB_URL=http://127.0.0.1:8090
MASTER_PB_ADMIN_EMAIL=faruq.blogger@gmail.com
MASTER_PB_ADMIN_PASSWORD=sudahlupa
PUBLIC_APP_URL=https://examku.my.id
"""

with open("temp_env", "w", encoding="utf-8") as f:
    f.write(env_content)

print("File written locally.")

# SCP to the server
try:
    subprocess.run(["scp", "temp_env", "root@64.235.41.108:/opt/frontend/ujian/payment-api/.env"], check=True)
    print("SCP successful.")
except subprocess.CalledProcessError as e:
    print("SCP failed:", e)

# Restart the payment-api service or process
try:
    # Assuming pm2 is used or systemd. Let's list pm2 or just restart the node process
    result = subprocess.run(["ssh", "root@64.235.41.108", "pm2 restart payment-api || systemctl restart payment-api || pkill -f 'server.js' && cd /opt/frontend/ujian/payment-api && nohup node server.js > out.log 2>&1 &"], capture_output=True, text=True)
    print("Restart command output:", result.stdout)
    if result.stderr:
        print("Restart command stderr:", result.stderr)
except Exception as e:
    print("Restart failed:", e)

import os
os.remove("temp_env")
