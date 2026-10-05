import requests

url = "https://examku.my.id/api/collections/_superusers/auth-with-password"
payload = {
    "identity": "faruq.blogger@gmail.com",
    "password": "admin123"
}
r = requests.post(url, json=payload)
token = r.json().get("token")

if token:
    headers = {"Authorization": token}
    col_payload = {
        "fields": [
            {"name": "id", "type": "text", "required": True, "system": True, "primaryKey": True, "autogeneratePattern": "[a-z0-9]{15}", "min": 15, "max": 15, "pattern": "^[a-z0-9]+$"},
            {"name": "bank_code", "type": "text", "required": True},
            {"name": "bank_name", "type": "text", "required": True},
            {"name": "account_number", "type": "text", "required": True},
            {"name": "account_name", "type": "text", "required": True},
            {"name": "is_active", "type": "bool"}
        ]
    }
    r2 = requests.patch("https://examku.my.id/api/collections/bank_accounts", json=col_payload, headers=headers)
    print(r2.status_code, r2.text)
