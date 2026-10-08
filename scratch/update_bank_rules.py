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
        "createRule": "@request.auth.collectionName = 'super_admins'",
        "updateRule": "@request.auth.collectionName = 'super_admins'",
        "deleteRule": "@request.auth.collectionName = 'super_admins'"
    }
    r2 = requests.patch("https://examku.my.id/api/collections/bank_accounts", json=col_payload, headers=headers)
    print(r2.status_code, r2.text)
else:
    print("Failed to auth")
