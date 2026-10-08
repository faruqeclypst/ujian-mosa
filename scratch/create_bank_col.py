import requests

url = "https://examku.my.id/api/admins/auth-with-password"
payload = {
    "identity": "faruq.blogger@gmail.com",
    "password": "admin123"
}
r = requests.post(url, json=payload)
data = r.json()
token = data.get("token")

if token:
    headers = {"Authorization": token}
    col_payload = {
        "name": "bank_accounts",
        "type": "base",
        "system": False,
        "schema": [
            {"name": "bank_code", "type": "text", "required": True},
            {"name": "bank_name", "type": "text", "required": True},
            {"name": "account_number", "type": "text", "required": True},
            {"name": "account_name", "type": "text", "required": True},
            {"name": "is_active", "type": "bool"}
        ],
        "listRule": "",
        "viewRule": "",
        "createRule": None,
        "updateRule": None,
        "deleteRule": None
    }
    r2 = requests.post("https://examku.my.id/api/collections", json=col_payload, headers=headers)
    print(r2.status_code, r2.text)
else:
    print("Login failed")
