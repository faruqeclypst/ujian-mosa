# SumoPod Sandbox Payment

Status: backend skeleton created locally. VPS deployment pending.

## VPS folder

```text
/opt/frontend/ujian/payment-api
```

Files: `server.js`, `package.json`, `.env`. Service listens on `127.0.0.1:8787`.

## SumoPod sandbox settings

Sandbox API base URL:

```text
https://api-pay-sandbox.sumopod.com/api/v1
```

Webhook URL:

```text
https://examku.my.id/api/sumopod/webhook
```

Create payment endpoint:

```text
POST /api/sumopod/create-payment
```

Health check:

```text
https://examku.my.id/health
```

## Redirect URLs

Set in SumoPod Sandbox Settings > Redirect URLs:

Success:

```text
https://examku.my.id/admin/invoice?payment=success
```

Cancel:

```text
https://examku.my.id/admin/invoice?payment=cancelled
```

Backend adds `invoice=<invoice_id>` per payment.

## Webhook setup

1. Open SumoPod dashboard.
2. Switch to Sandbox.
3. Open Managed Payment > Settings > Webhook.
4. Set URL to `https://examku.my.id/api/sumopod/webhook`.
5. Save.
6. Copy generated Webhook Token or Signing Secret.
7. Store it in VPS `.env`, never frontend or Git.
8. Enable `payment.completed`, `payment.failed`, and `payment.expired`.
9. Click `Save & Test` after backend is running.

## VPS environment

Create `/opt/frontend/ujian/payment-api/.env`:

```env
PORT=8787
SUMOPOD_API_URL=https://api-pay-sandbox.sumopod.com/api/v1
SUMOPOD_API_KEY=replace_with_new_sandbox_key
SUMOPOD_WEBHOOK_TOKEN=replace_with_dashboard_token
# Alternative: SUMOPOD_WEBHOOK_SECRET=whsec_...
MASTER_PB_URL=http://127.0.0.1:8090
MASTER_PB_ADMIN_EMAIL=replace_with_master_admin_email
MASTER_PB_ADMIN_PASSWORD=replace_with_master_admin_password
PUBLIC_APP_URL=https://examku.my.id
```

The API key pasted in chat is exposed. Rotate it before testing.

## Caddy route

Add route to the main `examku.my.id` site, not tenant Caddy blocks:

```text
examku.my.id {
    root * /opt/frontend/ujian/dist
    handle /api/sumopod/* {
        reverse_proxy 127.0.0.1:8787
    }
    handle /health {
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Validate and reload:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## Systemd service

Create `/etc/systemd/system/exam-aa-payment-api.service`:

```ini
[Unit]
Description=EXAM AA SumoPod Sandbox Payment API
After=network.target pb-master.service

[Service]
Type=simple
WorkingDirectory=/opt/frontend/ujian/payment-api
EnvironmentFile=/opt/frontend/ujian/payment-api/.env
ExecStart=/usr/bin/node /opt/frontend/ujian/payment-api/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
systemctl daemon-reload
systemctl enable --now exam-aa-payment-api
systemctl status exam-aa-payment-api
```

## Test order

1. Confirm `/health` returns `{"ok":true,"environment":"sandbox"}`.
2. Configure webhook and click `Save & Test`.
3. Add tenant invoice with positive amount.
4. Create payment and open returned `payment_link_url`.
5. Complete sandbox payment.
6. Confirm webhook changes matching invoice status to `paid`.
7. Refresh tenant and superadmin invoice pages.

## Security

- Never expose API key in React.
- Never commit `.env`.
- Verify webhook token or Svix signature before trusting payload.
- Use sandbox key until production verification finishes.
