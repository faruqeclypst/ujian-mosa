/* =========================================================
   OFFLINE LICENSE VALIDATOR (Pure JSVM Module)
   Kriptografi Asimetris RSA-2048 & Validasi Lisensi Server Offline
   Zero dependencies, 100% kompatibel dengan Goja PocketBase JSVM
   ========================================================= */

const RSA_MODULUS_HEX =
    "c64312638bc4d3f62a1b7575f32ac9c47d8f447194d0fbb66484ff7bad3f3ed01cd26823e3503c6b1e0950687a99e2d5d8487acbafca30aa0152a2d0fbcf3b00172291834a3e5323041d4d00621a6f54d69332c5758974d282b31efb8c29798c7859087436d618e095ae560af9dee91bc56f8ecc59eafae063fbdc351142374d0a15f563a42d095e2e2eab2a5c05b6be7a8aaf3abf235f45fcbf164dc43d7f66bd53c2f91dff06c20d0341d9b199764c23e69940ef6450c4b7f860cfd3216192acec357e2fabacfe9471744c85e33a4f871c1947bce0370278ac809e00ecd5eed285bd6ca5da8405d85403eadab34e031cfab264c5e8c642d584d7eadc35f3b3";

const RSA_N = BigInt("0x" + RSA_MODULUS_HEX);
const LEGACY_SECRET = "EXAMKU_OFFLINE_SECRET_AUTH_KEY_2026_SECURE_SALT_9918";

function pbPureSha256(ascii) {
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
    let utf8 = "";
    try {
        utf8 = unescape(encodeURIComponent(ascii));
    } catch (_) {
        utf8 = ascii;
    }
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
    let result = "";
    for (let i = 0; i < 8; i++) {
        for (let j = 3; j >= 0; j--) {
            const byte = (hash[i] >>> (j * 8)) & 0xff;
            result += (byte < 16 ? "0" : "") + byte.toString(16);
        }
    }
    return result;
}

// Pure JS Base64 / Base64URL decode ke bytes (tanpa atob / Buffer)
function pbBase64UrlToBytes(base64url) {
    if (!base64url) return [];
    let b64 = base64url.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    const b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < b64.length; i++) {
        const c = b64[i];
        if (c === "=") break;
        const val = b64chars.indexOf(c);
        if (val === -1) continue;
        buffer = (buffer << 6) | val;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    return bytes;
}

// Pure JS Base64 decode ke UTF-8 string (tanpa atob / decodeURIComponent)
function pbBase64ToUtf8(b64Str) {
    const bytes = pbBase64UrlToBytes(b64Str);
    let str = "";
    for (let i = 0; i < bytes.length; ) {
        const b1 = bytes[i++];
        if (b1 < 0x80) {
            str += String.fromCharCode(b1);
        } else if (b1 >= 0xc0 && b1 < 0xe0) {
            const b2 = bytes[i++];
            str += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
        } else if (b1 >= 0xe0 && b1 < 0xf0) {
            const b2 = bytes[i++];
            const b3 = bytes[i++];
            str += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
        } else {
            const b2 = bytes[i++];
            const b3 = bytes[i++];
            const b4 = bytes[i++];
            let cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
            cp -= 0x10000;
            str += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        }
    }
    return str;
}

function pbBytesToHex(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i].toString(16);
        hex += b.length === 1 ? "0" + b : b;
    }
    return hex;
}

function pbHexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
}

function pbVerifyRsaSignature(base64Payload, base64Sig) {
    try {
        const sigBytes = pbBase64UrlToBytes(base64Sig);
        if (sigBytes.length !== 256) return false;

        const sigBigInt = BigInt("0x" + pbBytesToHex(sigBytes));
        let base = sigBigInt;
        let exp = 65537n;
        let res = 1n;
        while (exp > 0n) {
            if (exp & 1n) res = (res * base) % RSA_N;
            base = (base * base) % RSA_N;
            exp >>= 1n;
        }

        let hex = res.toString(16);
        while (hex.length < 512) hex = "0" + hex;
        const decryptedBytes = pbHexToBytes(hex);

        if (decryptedBytes[0] !== 0x00 || decryptedBytes[1] !== 0x01) return false;

        let sepIndex = 2;
        while (sepIndex < decryptedBytes.length && decryptedBytes[sepIndex] === 0xff) {
            sepIndex++;
        }
        if (decryptedBytes[sepIndex] !== 0x00) return false;

        const hashBytes = decryptedBytes.slice(decryptedBytes.length - 32);
        const hashInPadding = pbBytesToHex(hashBytes);
        const actualHash = pbPureSha256(base64Payload);

        return hashInPadding.toLowerCase() === actualHash.toLowerCase();
    } catch (_) {
        return false;
    }
}

function pbVerifyLicense(licenseCode) {
    if (!licenseCode || typeof licenseCode !== "string") {
        return { valid: false, message: "Kode lisensi kosong" };
    }
    const clean = licenseCode.trim();
    const parts = clean.split(".");
    if (parts.length !== 4 || parts[0] !== "EXAMKU-OFFLINE") {
        return { valid: false, message: "Format kode lisensi tidak valid" };
    }

    const version = parts[1];
    const base64Payload = parts[2];
    const givenSig = parts[3];

    let payload = null;
    try {
        const jsonStr = pbBase64ToUtf8(base64Payload);
        payload = JSON.parse(jsonStr);
    } catch (_) {
        return { valid: false, message: "Gagal decode payload" };
    }

    if (!payload || !payload.school_name || !payload.valid_until) {
        return { valid: false, message: "Informasi lisensi tidak lengkap" };
    }

    let isSigValid = false;
    let isAsymmetric = false;

    if (version === "v2") {
        isSigValid = pbVerifyRsaSignature(base64Payload, givenSig);
        isAsymmetric = true;
        if (!isSigValid) {
            return { valid: false, message: "Tanda tangan digital RSA-2048 tidak valid (lisensi palsu)" };
        }
    } else if (version === "v1") {
        const expectedHash = pbPureSha256(base64Payload + "::" + LEGACY_SECRET);
        isSigValid = givenSig.toLowerCase() === expectedHash.substring(0, 16).toLowerCase();
        if (!isSigValid) {
            return { valid: false, message: "Tanda tangan lisensi legasi tidak cocok" };
        }
    } else {
        return { valid: false, message: "Versi lisensi tidak didukung" };
    }

    const expiryDate = new Date(payload.valid_until + "T23:59:59");
    if (new Date() > expiryDate) {
        return { valid: false, isExpired: true, message: "Masa berlaku izin server telah habis", payload };
    }

    return { valid: true, isAsymmetric, payload };
}

module.exports = {
    pbVerifyLicense,
    pbVerifyRsaSignature,
    pbPureSha256,
    pbBase64ToUtf8,
    pbBase64UrlToBytes
};
