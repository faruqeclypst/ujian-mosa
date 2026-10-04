const crypto = require('crypto');
const fs = require('fs');

const privateKey = fs.readFileSync('vps/license_private_key.pem', 'utf8');
const modulusHex = fs.readFileSync('vps/license_modulus_hex.txt', 'utf8').trim();
const modulusBigInt = BigInt('0x' + modulusHex);

// Function to sign a payload (runs on VPS / Super Admin)
function signLicenseV2(payloadObj) {
  const jsonStr = JSON.stringify(payloadObj);
  const base64Payload = Buffer.from(jsonStr, 'utf8').toString('base64');
  
  const signer = crypto.createSign('SHA256');
  signer.update(base64Payload);
  signer.end();
  const signatureBuffer = signer.sign(privateKey);
  const base64Sig = signatureBuffer.toString('base64url');
  
  return `EXAMKU-OFFLINE.v2.${base64Payload}.${base64Sig}`;
}

// Function to verify in pure JS BigInt (runs on Offline Server & Browser)
function verifyLicensePureJs(licenseCode) {
  if (!licenseCode || typeof licenseCode !== 'string') return { valid: false, message: 'Kode kosong' };
  const parts = licenseCode.trim().split('.');
  if (parts.length !== 4) return { valid: false, message: 'Format salah' };
  
  const [prefix, version, base64Payload, base64Sig] = parts;
  if (prefix !== 'EXAMKU-OFFLINE') return { valid: false, message: 'Prefix salah' };

  if (version === 'v2') {
    // RSA-2048 verification
    const sigBuffer = Buffer.from(base64Sig, 'base64url');
    if (sigBuffer.length !== 256) return { valid: false, message: 'Ukuran tanda tangan RSA tidak valid' };

    const sigBigInt = BigInt('0x' + sigBuffer.toString('hex'));
    let base = sigBigInt;
    let exp = 65537n;
    let res = 1n;
    while (exp > 0n) {
      if (exp & 1n) res = (res * base) % modulusBigInt;
      base = (base * base) % modulusBigInt;
      exp >>= 1n;
    }

    const paddedHex = res.toString(16).padStart(512, '0');
    const decryptedBuf = Buffer.from(paddedHex, 'hex');

    // PKCS#1 v1.5 padding check
    if (decryptedBuf[0] !== 0x00 || decryptedBuf[1] !== 0x01) {
      return { valid: false, message: 'Tanda tangan RSA gagal (padding tidak valid)' };
    }

    let sepIndex = 2;
    while (sepIndex < decryptedBuf.length && decryptedBuf[sepIndex] === 0xff) {
      sepIndex++;
    }
    if (decryptedBuf[sepIndex] !== 0x00) {
      return { valid: false, message: 'Pemisah padding RSA tidak ditemukan' };
    }

    const expectedHashInPadding = decryptedBuf.slice(decryptedBuf.length - 32).toString('hex');
    const actualHash = crypto.createHash('sha256').update(base64Payload).digest('hex');

    if (expectedHashInPadding !== actualHash) {
      return { valid: false, message: 'Tanda tangan digital tidak cocok dengan isi lisensi' };
    }

    // Parse payload
    const jsonStr = Buffer.from(base64Payload, 'base64').toString('utf8');
    const payload = JSON.parse(jsonStr);

    const expiryDate = new Date(`${payload.valid_until}T23:59:59`);
    if (new Date() > expiryDate) {
      return { valid: false, isExpired: true, message: `Lisensi telah berakhir pada ${payload.valid_until}`, payload };
    }

    return { valid: true, message: 'Lisensi resmi RSA-2048 valid', payload };
  }

  return { valid: false, message: 'Versi tidak dikenali' };
}

// Test with SD NEGERI 1 PAGAR AIR
const samplePayload = {
  school_name: "SD NEGERI 1 PAGAR AIR",
  slug: "sd1pagarair",
  npsn: "10100295",
  valid_until: "2026-10-31",
  max_students: 0,
  issued_at: new Date().toISOString(),
  notes: "Izin Resmi Ujian Laboratorium Sekolah (Asymmetric RSA-2048)"
};

const signedCode = signLicenseV2(samplePayload);
console.log("=== GENERATED V2 LICENSE ===");
console.log(signedCode);

console.log("\n=== VERIFYING V2 LICENSE ===");
const result = verifyLicensePureJs(signedCode);
console.log("Verification result:", result);

console.log("\n=== TESTING FORGERY (MODIFIED EXPIRATION) ===");
const forgedParts = signedCode.split('.');
const payloadObj = JSON.parse(Buffer.from(forgedParts[2], 'base64').toString('utf8'));
payloadObj.valid_until = "2099-12-31"; // Hacked date!
const hackedB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
const forgedLicense = `EXAMKU-OFFLINE.v2.${hackedB64}.${forgedParts[3]}`;
const forgedResult = verifyLicensePureJs(forgedLicense);
console.log("Forged result:", forgedResult);
