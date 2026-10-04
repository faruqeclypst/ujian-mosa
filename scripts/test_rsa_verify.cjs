const crypto = require('crypto');

// 1. Generate 2048-bit RSA keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

// 2. Export modulus (n)
const jwk = publicKey.export({ format: 'jwk' });
const nBuffer = Buffer.from(jwk.n, 'base64url');
const nHex = nBuffer.toString('hex');
const modulusBigInt = BigInt('0x' + nHex);

console.log("Modulus length in bits:", nBuffer.length * 8);

// 3. Create a payload and sign it using private key (SHA-256)
const payload = "school=SD NEGERI 1 PAGAR AIR;until=2026-10-31;max=0";
const sign = crypto.createSign('SHA256');
sign.update(payload);
sign.end();
const signature = sign.sign(privateKey);
console.log("Signature length in bytes:", signature.length);

// 4. VERIFY USING PURE JS BIGINT (Zero external libraries, runs anywhere!)
function verifyRsaPureJs(payloadStr, sigBuffer, nBigInt) {
  const sigBigInt = BigInt('0x' + sigBuffer.toString('hex'));
  let base = sigBigInt;
  let exp = 65537n;
  let res = 1n;
  while (exp > 0n) {
    if (exp & 1n) res = (res * base) % nBigInt;
    base = (base * base) % nBigInt;
    exp >>= 1n;
  }
  
  // Format res as 256 bytes
  let hex = res.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const paddedHex = hex.padStart(512, '0');
  const decryptedBuf = Buffer.from(paddedHex, 'hex');

  // Verify PKCS#1 v1.5 padding:
  // 00 01 FF FF ... FF 00 [SHA-256 DigestInfo 19 bytes] [32 bytes SHA-256 Hash]
  if (decryptedBuf[0] !== 0x00 || decryptedBuf[1] !== 0x01) {
    return false;
  }

  // Find 0x00 separator after 0xFF padding
  let sepIndex = 2;
  while (sepIndex < decryptedBuf.length && decryptedBuf[sepIndex] === 0xff) {
    sepIndex++;
  }
  if (decryptedBuf[sepIndex] !== 0x00) return false;

  // The last 32 bytes is the SHA-256 hash
  const hashInPadding = decryptedBuf.slice(decryptedBuf.length - 32).toString('hex');
  
  // Calculate actual hash of payload
  const actualHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
  
  return hashInPadding === actualHash;
}

const isValid = verifyRsaPureJs(payload, signature, modulusBigInt);
console.log("Verification with pure JS BigInt:", isValid);

// Tamper test
const tamperedPayload = "school=SD NEGERI 1 PAGAR AIR;until=2099-12-31;max=0";
const isTamperedValid = verifyRsaPureJs(tamperedPayload, signature, modulusBigInt);
console.log("Tampered payload verification:", isTamperedValid);
