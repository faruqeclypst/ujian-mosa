import os

file_path = r"d:\PROJECT\ujian\index.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# The target to replace
target = "<title>EXAMKU - Platform CBT Online & Mandiri</title>"

replacement = """
  <title>EXAMKU - Platform CBT Online & Mandiri</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="EXAMKU - Platform CBT Online & Mandiri" />
  <meta name="description" content="EXAMKU adalah platform Ujian Berbasis Komputer (CBT) modern, mandiri, dan anti-contek untuk sekolah dan institusi. Kelola ujian dengan aman, praktis, dan profesional." />
  <meta name="keywords" content="CBT Online, Ujian Online, Aplikasi Ujian, EXAMKU, Sekolah, Anti-Contek, Ujian Mandiri, Platform Edukasi, Computer Based Test" />
  <meta name="author" content="EXAMKU" />
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://examku.my.id/" />
  <meta property="og:title" content="EXAMKU - Platform CBT Online & Mandiri" />
  <meta property="og:description" content="EXAMKU adalah platform Ujian Berbasis Komputer (CBT) modern, mandiri, dan anti-contek untuk sekolah dan institusi. Kelola ujian dengan aman dan praktis." />
  <meta property="og:image" content="https://examku.my.id/og-thumbnail.jpg" />
  <meta property="og:site_name" content="EXAMKU" />

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="https://examku.my.id/" />
  <meta property="twitter:title" content="EXAMKU - Platform CBT Online & Mandiri" />
  <meta property="twitter:description" content="Platform CBT modern dan anti-contek untuk manajemen ujian sekolah." />
  <meta property="twitter:image" content="https://examku.my.id/og-thumbnail.jpg" />
"""

if target in content:
    new_content = content.replace(target, replacement.strip("\n"))
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Meta tags added successfully.")
else:
    print("Target not found.")
