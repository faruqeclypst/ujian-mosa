from PIL import Image
import os

filepath = r"d:\PROJECT\ujian\public\og-thumbnail.jpg"
img = Image.open(filepath)
img = img.convert("RGB")
img.save(filepath, "JPEG", optimize=True, quality=50)
print(f"New size: {os.path.getsize(filepath)} bytes")
