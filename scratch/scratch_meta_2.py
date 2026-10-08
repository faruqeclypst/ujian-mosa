import os

file_path = r"d:\PROJECT\ujian\index.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = '<meta property="og:image" content="https://examku.my.id/og-thumbnail.jpg" />'
target_twitter = '<meta property="twitter:image" content="https://examku.my.id/og-thumbnail.jpg" />'

replacement = """<meta property="og:image" content="https://examku.my.id/logo-examku-cbt.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />"""

if target in content:
    content = content.replace(target, replacement)
if target_twitter in content:
    content = content.replace(target_twitter, '<meta property="twitter:image" content="https://examku.my.id/logo-examku-cbt.png" />')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.html")
