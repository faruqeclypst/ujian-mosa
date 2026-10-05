import requests

banks = [
  "Bank Mandiri", "Bank Negara Indonesia", "Bank Syariah Indonesia", 
  "Permata Bank", "Bank Danamon", "Bank Jago", "SeaBank Indonesia",
  "Bank Aceh Syariah", "Bank BJB", "Bank DKI", "Bank Jatim", "Bank Sumut", "Bank Nagari"
]
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for bank in banks:
    url = f"https://id.wikipedia.org/w/api.php?action=query&titles={requests.utils.quote(bank)}&prop=pageimages&pithumbsize=500&format=json"
    try:
        r2 = requests.get(url, headers=headers).json()
        pages2 = r2.get("query", {}).get("pages", {})
        found = False
        for k2, v2 in pages2.items():
            if "thumbnail" in v2:
                print(f"{bank}: {v2['thumbnail']['source']}")
                found = True
        if not found:
            print(f"{bank}: NOT FOUND")
    except Exception as e:
        print(f"Error for {bank}: {e}")
