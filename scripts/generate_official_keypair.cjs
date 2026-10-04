const crypto = require('crypto');
const fs = require('fs');

// Generate 2048-bit RSA keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save private key for Master VPS
fs.writeFileSync('vps/license_private_key.pem', privateKey);
fs.writeFileSync('vps/license_public_key.pem', publicKey);

// Extract modulus as hex for embedded pure-JS verification
const pubKeyObj = crypto.createPublicKey(publicKey);
const jwk = pubKeyObj.export({ format: 'jwk' });
const nBuffer = Buffer.from(jwk.n, 'base64url');
const nHex = nBuffer.toString('hex');

fs.writeFileSync('vps/license_modulus_hex.txt', nHex);

console.log("=== KEYPAIR GENERATION SUCCESS ===");
console.log("Modulus length:", nHex.length, "hex characters (2048 bits)");
console.log("Modulus sample:", nHex.substring(0, 32) + "..." + nHex.substring(nHex.length - 32));
console.log("Private key saved to: vps/license_private_key.pem");
console.log("Public key saved to: vps/license_public_key.pem");
