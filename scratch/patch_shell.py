import sys

with open('dist-shell/index.html', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """      if (ip && ip.trim()) {
        let cleanIp = ip.trim();
        if (!cleanIp.startsWith("http://") && !cleanIp.startsWith("https://")) {
          cleanIp = "http://" + cleanIp;
        }
        window.location.href = cleanIp;
      }"""

new_block = """      if (ip && ip.trim()) {
        let cleanIp = ip.trim();
        if (!cleanIp.startsWith("http://") && !cleanIp.startsWith("https://")) {
          cleanIp = "http://" + cleanIp;
        }
        
        // Auto-append port :8090 if the user just typed an IP address without a port
        try {
          const urlObj = new URL(cleanIp);
          if (!urlObj.port && /^(192\\.168|10\\.|172\\.)/.test(urlObj.hostname)) {
            cleanIp = cleanIp.replace(urlObj.hostname, urlObj.hostname + ":8090");
          }
        } catch(e) {}
        
        window.location.href = cleanIp;
      }"""

code = code.replace(old_block, new_block)
with open('dist-shell/index.html', 'w', encoding='utf-8') as f:
    f.write(code)
