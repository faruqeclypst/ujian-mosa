import sys

with open('src/pages/landing/SelectSchoolPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """    // Handler submit eksekusi koneksi ke Local Server
    const handleExecuteConnectLocal = async (targetUrl: string, schoolTarget?: SchoolRecord | null) => {
      const cleanUrl = normalizeUrl(targetUrl);
      if (!cleanUrl) {
        setLocalConnectError("Silakan masukkan alamat IP server lokal proktor.");
        return;
      }

      setIsConnectingLocal(true);
      setLocalConnectError(null);

      const probe = await probeLocalServer(cleanUrl);
      if (!probe.success) {
        setIsConnectingLocal(false);
        setLocalConnectError(probe.error || "Gagal menghubungi server lokal di alamat tersebut.");
        return;
      }"""

new_block = """    // Handler submit eksekusi koneksi ke Local Server
    const handleExecuteConnectLocal = async (targetUrl: string, schoolTarget?: SchoolRecord | null) => {
      const cleanUrl = normalizeUrl(targetUrl);
      if (!cleanUrl) {
        setLocalConnectError("Silakan masukkan alamat IP server lokal proktor.");
        return;
      }

      setIsConnectingLocal(true);
      setLocalConnectError(null);

      // BYPASS PROBE JIKA DI APK (NATIVE):
      // Karena APK mengarah ke https://examku.my.id (Secure Context), browser memblokir fetch() ke http:// (Mixed Content Policy).
      // Sehingga probe (maupun Auto-Scan) akan selalu gagal dari APK.
      // Solusinya: Langsung alihkan href, WebView akan menanganinya dengan normal.
      if (Capacitor.isNativePlatform() || window.location.protocol === 'https:') {
         const schoolName = schoolTarget ? schoolTarget.name : "Server Lokal";
         saveRecentServer(cleanUrl, schoolName);
         localStorage.setItem("local_server_url", cleanUrl);
         
         const localRecord: SchoolRecord = {
           id: schoolTarget ? `local_${schoolTarget.id}` : `local_server_${cleanUrl.replace(/[^a-z0-9]/gi, "_")}`,
           name: schoolName,
           slug: "local",
           pb_url: cleanUrl,
           type: "school",
           is_active: true,
         };
         localStorage.setItem("tenant_school_cache_local", JSON.stringify(localRecord));
         
         window.location.href = cleanUrl;
         return;
      }

      const probe = await probeLocalServer(cleanUrl);
      if (!probe.success) {
        setIsConnectingLocal(false);
        setLocalConnectError(probe.error || "Gagal menghubungi server lokal di alamat tersebut.");
        return;
      }"""

code = code.replace(old_block, new_block)
with open('src/pages/landing/SelectSchoolPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
