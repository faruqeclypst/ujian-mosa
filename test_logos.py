import requests

banks = [
  {"code": "BCA", "logo": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg"},
  {"code": "MANDIRI", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_of_Bank_Mandiri.svg"},
  {"code": "BNI", "logo": "https://upload.wikimedia.org/wikipedia/id/5/55/BNI_logo.svg"},
  {"code": "BRI", "logo": "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg"},
  {"code": "BSI", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Bank_Syariah_Indonesia.svg"},
  {"code": "CIMB", "logo": "https://upload.wikimedia.org/wikipedia/commons/3/38/CIMB_Niaga_logo.svg"},
  {"code": "PERMATA", "logo": "https://upload.wikimedia.org/wikipedia/commons/3/38/PermataBank_logo.svg"},
  {"code": "DANAMON", "logo": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Bank_Danamon_logo.svg"},
  {"code": "JAGO", "logo": "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png"},
  {"code": "SEABANK", "logo": "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png"},
  {"code": "BPD_ACEH", "logo": "https://upload.wikimedia.org/wikipedia/id/3/3f/Logo_Bank_Aceh_Syariah.png"},
  {"code": "BJB", "logo": "https://upload.wikimedia.org/wikipedia/commons/7/77/Logo_Bank_BJB.svg"},
  {"code": "DKI", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_Bank_DKI.svg"},
  {"code": "JATIM", "logo": "https://upload.wikimedia.org/wikipedia/commons/4/41/Logo_Bank_Jatim.svg"},
  {"code": "SUMUT", "logo": "https://upload.wikimedia.org/wikipedia/commons/8/87/Logo_Bank_Sumut.svg"},
  {"code": "NAGARI", "logo": "https://upload.wikimedia.org/wikipedia/commons/7/74/Logo_Bank_Nagari.svg"}
]

for b in banks:
    try:
        r = requests.head(b["logo"], headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True)
        print(f"{b['code']}: {r.status_code}")
    except:
        print(f"{b['code']}: ERROR")
