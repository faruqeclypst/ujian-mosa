const fs = require('fs');

const modulusHex = fs.readFileSync('vps/license_modulus_hex.txt', 'utf8').trim();
const modulusBigInt = BigInt('0x' + modulusHex);

// Pure JS browser-compatible helper functions (NO Node.js Buffer!)
function base64UrlToBytes(base64UrlStr) {
  let base64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Pure SHA-256
function pureSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  const words = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;
  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }
      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const temp1 = (h + sigma1 + ch + k[j] + w[j]) | 0;
      const temp2 = (sigma0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

function verifyRsaPureBrowser(licenseCode) {
  const parts = licenseCode.trim().split('.');
  const base64Payload = parts[2];
  const base64Sig = parts[3];

  const sigBytes = base64UrlToBytes(base64Sig);
  if (sigBytes.length !== 256) return false;

  const sigBigInt = BigInt('0x' + bytesToHex(sigBytes));
  let base = sigBigInt;
  let exp = 65537n;
  let res = 1n;
  while (exp > 0n) {
    if (exp & 1n) res = (res * base) % modulusBigInt;
    base = (base * base) % modulusBigInt;
    exp >>= 1n;
  }

  const paddedHex = res.toString(16).padStart(512, '0');
  const decryptedBytes = hexToBytes(paddedHex);

  if (decryptedBytes[0] !== 0x00 || decryptedBytes[1] !== 0x01) return false;

  let sepIndex = 2;
  while (sepIndex < decryptedBytes.length && decryptedBytes[sepIndex] === 0xff) {
    sepIndex++;
  }
  if (decryptedBytes[sepIndex] !== 0x00) return false;

  const hashInPadding = bytesToHex(decryptedBytes.slice(decryptedBytes.length - 32));
  const actualHash = pureSha256(base64Payload);

  return hashInPadding.toLowerCase() === actualHash.toLowerCase();
}

// Test with the generated code from previous step
const testCode = 'EXAMKU-OFFLINE.v2.eyJzY2hvb2xfbmFtZSI6IlNEIE5FR0VSSSAxIFBBR0FSIEFJUiIsInNsdWciOiJzZDFwYWdhcmFpciIsIm5wc24iOiIxMDEwMDI5NSIsInZhbGlkX3VudGlsIjoiMjAyNi0xMC0zMSIsIm1heF9zdHVkZW50cyI6MCwiaXNzdWVkX2F0IjoiMjAyNi0xMC0wM1QxOTowMDowMi40NDZaIiwibm90ZXMiOiJJemluIFJlc21pIFVqaWFuIExhYm9yYXRvcml1bSBTZWtvbGFoIChBc3ltbWV0cmljIFJTQS0yMDQ4KSJ9.cL32dg8KQ863mxPu4pSdCHzjz4586MaCv37aOaZlvRkHUVoKHJuCMjlwwROigSawnLyCGFaMWPX5A5cj3JINdjrN7rawb9JKxN3yJ36K0b_XjPVmfN2TS4Oh4k92ey4ckwzjXC0SjYcGpm7PD-fVNZ2vAE0sROOgO0tBJAOaf5AIMk_TvdKK96J5CQ1ZRQbN1cEtVLAFyyLSR_pqCh6W3RIxJ5CFYIeF3EpQnUTzR7XNmdDs7jumqcCxE9ZtaxDGkbOSrutr3jHsao7Jf9rKgqx9jzw9Z8zo8pvjwSitLfyKVYQ2_Ki0wawo8UMFKx4o3oGPdKxuxTh-pDQRKU9R0A';

console.log("Browser-only pure verification without Buffer:", verifyRsaPureBrowser(testCode));
