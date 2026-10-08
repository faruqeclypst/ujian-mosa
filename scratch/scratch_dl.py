import os

filepath = r"d:\PROJECT\ujian\src\pages\tenant\DownloadAppsPage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add the function inside the component
func_code = """  const handleDownloadSeb = () => {
    const schoolUrl = window.location.origin;
    const schoolDomain = window.location.hostname;
    const slug = schoolDomain.split('.')[0] || "ujian";

    const sebConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>startURL</key>
    <string>${schoolUrl}</string>
    <key>allowQuit</key>
    <true/>
    <key>quitURL</key>
    <string>${schoolUrl}/exam</string>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>browserViewMode</key>
    <integer>0</integer>
    <key>enableAudio</key>
    <true/>
    <key>enableScreenCapture</key>
    <false/>
    <key>enableSpellChecking</key>
    <false/>
    <key>showTaskBar</key>
    <false/>
    <key>showReloadButton</key>
    <true/>
    <key>showTime</key>
    <true/>
    <key>allowSpellCheck</key>
    <false/>
</dict>
</plist>`;

    const blob = new Blob([sebConfigXml], { type: "application/seb" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CBT-${slug}.seb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
"""
if "handleDownloadSeb" not in content:
    content = content.replace('  const { school } = useTenant();', '  const { school } = useTenant();\n\n' + func_code)

# Add buttons
target_ios = """            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <a
                href="https://apps.apple.com/us/app/safe-exam-browser/id1155002283"
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                <Smartphone size={16} />
                App Store (SEB)
              </a>
            </div>"""
rep_ios = target_ios.replace('            </div>', '              <button onClick={handleDownloadSeb} className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"><Download size={16} /> Konfigurasi (.seb)</button>\n            </div>')

target_win = """            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <a
                href="https://safeexambrowser.org/download_en.html"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Unduh SEB (Windows)
              </a>
            </div>"""
rep_win = target_win.replace('            </div>', '              <button onClick={handleDownloadSeb} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-800 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"><Download size={16} /> Konfigurasi (.seb)</button>\n            </div>')

content = content.replace(target_ios, rep_ios)
content = content.replace(target_win, rep_win)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated DownloadAppsPage")
