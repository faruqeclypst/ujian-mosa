import sys
import re

with open('src/pages/landing/SelectSchoolPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """const normalizeUrl = (raw: string): string => {
  let clean = raw.trim();
  if (!clean) return "";
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "http://" + clean;
  }
  return clean.replace(/\/+$/, "");
};"""

new_block = """const normalizeUrl = (raw: string): string => {
  let clean = raw.trim();
  if (!clean) return "";
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "http://" + clean;
  }
  
  // Auto-append port :8090 if the user just typed an IP address without a port
  const urlObj = new URL(clean);
  if (!urlObj.port && /^(192\.168|10\.|172\.)/.test(urlObj.hostname)) {
    clean = clean.replace(urlObj.hostname, urlObj.hostname + ":8090");
  }
  
  return clean.replace(/\/+$/, "");
};"""

code = code.replace(old_block, new_block)
with open('src/pages/landing/SelectSchoolPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
