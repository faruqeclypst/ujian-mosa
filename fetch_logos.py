import requests
import json

banks = [
  "Bank Mandiri", "Bank Negara Indonesia", "Bank Syariah Indonesia", 
  "Permata Bank", "Bank Danamon", "Bank Jago", "SeaBank Indonesia",
  "Bank Aceh Syariah", "Bank BJB", "Bank DKI", "Bank Jatim", "Bank Sumut", "Bank Nagari"
]

for bank in banks:
    url = f"https://en.wikipedia.org/w/api.php?action=query&titles={requests.utils.quote(bank)}&prop=pageimages&pithumbsize=500&format=json"
    r = requests.get(url).json()
    pages = r.get("query", {}).get("pages", {})
    for k, v in pages.items():
        if "thumbnail" in v:
            print(f"{bank}: {v['thumbnail']['source']}")
        else:
            # try indonesian wikipedia
            url2 = f"https://id.wikipedia.org/w/api.php?action=query&titles={requests.utils.quote(bank)}&prop=pageimages&pithumbsize=500&format=json"
            r2 = requests.get(url2).json()
            pages2 = r2.get("query", {}).get("pages", {})
            found = False
            for k2, v2 in pages2.items():
                if "thumbnail" in v2:
                    print(f"{bank} (ID): {v2['thumbnail']['source']}")
                    found = True
            if not found:
                print(f"{bank}: NOT FOUND")
