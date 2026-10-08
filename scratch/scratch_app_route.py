import os

filepath = r"d:\PROJECT\ujian\src\App.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import_statement = 'const DownloadAppsPage = lazy(() => import("./pages/tenant/DownloadAppsPage"));'
if "DownloadAppsPage" not in content:
    content = content.replace(
        'const ServerStatusPage = lazy(() => import("./pages/admin/ServerStatusPage"));',
        'const ServerStatusPage = lazy(() => import("./pages/admin/ServerStatusPage"));\nconst DownloadAppsPage = lazy(() => import("./pages/tenant/DownloadAppsPage"));'
    )

if 'path="/unduh"' not in content:
    content = content.replace(
        '<Route path="*" element={<NotFoundPage />} />',
        '<Route path="/unduh" element={<DownloadAppsPage />} />\n            <Route path="/download" element={<Navigate to="/unduh" replace />} />\n            <Route path="*" element={<NotFoundPage />} />'
    )

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated App.tsx")
