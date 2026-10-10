// ============================================================
// Fast Login untuk siswa — alternatif ringan pengganti bcrypt
// POST /api/fast-login { username, password }
// Verifikasi: SHA-256(pepper + username + password) vs field fastHash
// Pepper dari env FAST_LOGIN_PEPPER (disarankan) atau auto-generate via /dev/urandom.
// Rate limit: 20/menit per-akun + 2000/menit per-IP (ramah NAT sekolah).
// HANYA untuk collection "students".
// CATATAN: semua helper inline di handler (binding top-level
// tidak terlihat di callback routerAdd).
// ============================================================

routerAdd("POST", "/api/fast-login", (c) => {
    // --- SHA-256 murni JS ---
    function sha256(ascii) {
        function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
        var mp = Math.pow, mw = mp(2, 32), result = '';
        var words = [], bitLen = ascii.length * 8;
        var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
        var pc = k.length, comp = {};
        for (var cand = 2; pc < 64; cand++) {
            if (!comp[cand]) {
                for (var i = 0; i < 313; i += cand) comp[i] = cand;
                hash[pc] = (mp(cand, 0.5) * mw) | 0;
                k[pc++] = (mp(cand, 1 / 3) * mw) | 0;
            }
        }
        ascii += '\x80';
        while (ascii.length % 64 - 56) ascii += '\x00';
        for (var i = 0; i < ascii.length; i++) {
            var j = ascii.charCodeAt(i);
            if (j >> 8) return '';
            words[i >> 2] |= j << ((3 - i) % 4) * 8;
        }
        words[words.length] = (bitLen / mw) | 0;
        words[words.length] = bitLen;
        for (var j = 0; j < words.length;) {
            var w = words.slice(j, j += 16), oh = hash;
            hash = hash.slice(0, 8);
            for (var i = 0; i < 64; i++) {
                var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
                var t1 = hash[7]
                    + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
                    + ((e & hash[5]) ^ (~e & hash[6]))
                    + k[i]
                    + (w[i] = (i < 16) ? w[i] : (w[i - 16]
                        + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
                        + w[i - 7]
                        + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
                var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
                    + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
                hash = [(t1 + t2) | 0].concat(hash);
                hash[4] = (hash[4] + t1) | 0;
            }
            for (var i = 0; i < 8; i++) hash[i] = (hash[i] + oh[i]) | 0;
        }
        for (var i = 0; i < 8; i++) for (var j = 3; j + 1; j--) {
            var b = (hash[i] >> (j * 8)) & 255;
            result += ((b < 16) ? 0 : '') + b.toString(16);
        }
        return result;
    }
    function safeEqual(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        if (a.length !== b.length) return false;
        var d = 0;
        for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return d === 0;
    }

    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); } catch (e) {}

    try {
        // Pepper: prioritas 1 = env var, prioritas 2 = file lokal (auto-generate),
        // prioritas 3 = tolak (tidak ada pepper = tidak aman).
        var pepper = "";
        try { pepper = $os.getenv("FAST_LOGIN_PEPPER") || ""; } catch (e) {}
        if (!pepper) {
            // Auto-generate: simpan di file persisten di luar pb_data
            // (tidak ikut backup DB, tapi survive reboot).
            // Lokasi: <dataDir>/../fastlogin_pepper.key
            try {
                var dataDir = "";
                try { dataDir = $app.dataDir() || ""; } catch (e) {}
                var pepperFile = (dataDir ? dataDir + "/../fastlogin_pepper.key" : "./fastlogin_pepper.key");
                var saved = "";
                try { saved = String($os.readFile(pepperFile) || "").trim(); } catch (e) {}
                if (saved && saved.length >= 32) {
                    pepper = saved;
                } else {
                    // CSPRNG: baca dari /dev/urandom (Linux) untuk pepper yang aman.
                    // Math.random() TIDAK aman untuk secret kriptografi.
                    var _p = "";
                    try {
                        var _ur = $os.readFile("/dev/urandom");
                        // Ambil 32 byte pertama, encode ke hex (64 char)
                        var _bytes = [];
                        var _raw = String(_ur);
                        for (var _bi = 0; _bi < 32 && _bi < _raw.length; _bi++) {
                            _bytes.push(_raw.charCodeAt(_bi) & 0xff);
                        }
                        // Jika /dev/urandom tidak memberi cukup byte, fallback ke kombinasi
                        // Math.random + timestamp + counter (lebih baik dari Math.random murni,
                        // tapi tetap disarankan set FAST_LOGIN_PEPPER via env untuk produksi).
                        while (_bytes.length < 32) {
                            _bytes.push(Math.floor(Math.random() * 256) ^ (Date.now() & 0xff) ^ _bytes.length);
                        }
                        var _hex = "0123456789abcdef";
                        for (var _hi = 0; _hi < 32; _hi++) {
                            _p += _hex[(_bytes[_hi] >> 4) & 0xf] + _hex[_bytes[_hi] & 0xf];
                        }
                    } catch (e) {
                        // Fallback terakhir jika $os.readFile gagal total
                        var _chars = "0123456789abcdef";
                        for (var _i = 0; _i < 64; _i++) _p += _chars[Math.floor(Math.random() * 16)];
                        try { console.log("[FAST_LOGIN] WARNING: pepper generated without CSPRNG, set FAST_LOGIN_PEPPER env!"); } catch (_) {}
                    }
                    try { $os.writeFile(pepperFile, _p); } catch (e) {}
                    pepper = _p;
                    try { console.log("[FAST_LOGIN] pepper auto-generated: " + pepperFile); } catch (e) {}
                }
            } catch (e) {}
        }
        if (!pepper) return c.json(500, { message: "Fast login belum dikonfigurasi." });

        // --- Rate limit: per-akun + per-IP (ramah NAT sekolah) ---
        // Sekolah di balik 1 NAT: ratusan siswa share 1 IP publik.
        // Rate limit murni per-IP akan memblokir login massal yang sah.
        // Solusi: batasi per-username (cegah brute force 1 akun) dengan
        // batas IP yang longgar (cegah abuse skala besar).
        // - Per-username: max 20 percobaan/menit (brute force 1 akun diblokir)
        // - Per-IP: max 2000 req/menit (500 siswa login bareng tetap lolos)
        try {
            if (typeof __flRlUser === "undefined") __flRlUser = {};
            if (typeof __flRlIp === "undefined") __flRlIp = {};
            var _ip = "";
            try {
                var _h = c.requestInfo().headers || {};
                _ip = _h["x-forwarded-for"] || _h["x-real-ip"] || "unknown";
                if (_ip.indexOf(",") >= 0) _ip = _ip.split(",")[0].trim();
            } catch (e) { _ip = "unknown"; }
            // Baca username lebih awal untuk rate limit per-akun
            var _rlBody = {};
            try { _rlBody = c.requestInfo().body || {}; } catch (e) {}
            var _rlUser = String(_rlBody.username || _rlBody.identity || "").trim().toLowerCase() || "-";
            var _now = Date.now();
            // Per-username
            var _ru = __flRlUser[_rlUser] || { n: 0, t: _now };
            if (_now - _ru.t > 60000) { _ru = { n: 0, t: _now }; }
            _ru.n++;
            __flRlUser[_rlUser] = _ru;
            if (_ru.n > 20) return c.json(429, { message: "Terlalu banyak percobaan untuk akun ini. Tunggu sebentar." });
            // Per-IP (longgar untuk NAT)
            var _ri = __flRlIp[_ip] || { n: 0, t: _now };
            if (_now - _ri.t > 60000) { _ri = { n: 0, t: _now }; }
            _ri.n++;
            __flRlIp[_ip] = _ri;
            if (_ri.n > 2000) return c.json(429, { message: "Terlalu banyak percobaan. Tunggu sebentar." });
        } catch (e) {}

        var body = {};
        try { body = c.requestInfo().body || {}; } catch (e) {}
        var username = String(body.username || body.identity || "").trim();
        var password = String(body.password || "");
        if (!username || !password) return c.json(400, { message: "Username dan password wajib diisi." });

        var rec = null;
        try { rec = $app.findFirstRecordByData("students", "username", username); } catch (e) {}
        if (!rec) return c.json(400, { message: "Username atau password salah." });

        var stored = "";
        try { stored = rec.get("fastHash") || ""; } catch (e) {}

        // Jika belum punya fastHash: verifikasi via bcrypt, lalu migrasi otomatis
        if (!stored) {
            var bcryptOk = false;
            try { bcryptOk = rec.validatePassword(password); } catch (e) {}
            if (!bcryptOk) return c.json(400, { message: "Username atau password salah." });
            // Migrasi: hitung dan simpan fastHash
            var computed = sha256(pepper + username + password);
            try {
                rec.set("fastHash", computed);
                $app.save(rec);
            } catch (e) { try { console.error("[FAST_LOGIN] gagal simpan fastHash: " + (e && e.message ? e.message : String(e))); } catch (_) {} }
        } else {
            var computed = sha256(pepper + username + password);
            if (!safeEqual(computed, stored)) {
                // fastHash tidak cocok: mungkin password baru diganti.
                // Coba verifikasi bcrypt sebagai fallback, lalu refresh fastHash.
                var bcryptOk2 = false;
                try { bcryptOk2 = rec.validatePassword(password); } catch (e) {}
                if (!bcryptOk2) return c.json(400, { message: "Username atau password salah." });
                try {
                    rec.set("fastHash", computed);
                    $app.save(rec);
                } catch (e) { try { console.error("[FAST_LOGIN] gagal simpan fastHash: " + (e && e.message ? e.message : String(e))); } catch (_) {} }
            }
        }

        var token = "";
        try { token = rec.newAuthToken(); } catch (e) {
            return c.json(500, { message: "Gagal membuat token." });
        }
        var out = null;
        try { out = JSON.parse(JSON.stringify(rec)); delete out.fastHash; delete out.password; delete out.tokenKey; }
        catch (e) { out = { id: rec.id }; }
        return c.json(200, { token: token, record: out });
    } catch (err) {
        try { console.error("[FAST_LOGIN] error: " + (err && err.message ? err.message : String(err))); } catch (e) {}
        return c.json(500, { message: "Internal error." });
    }
});

routerAdd("OPTIONS", "/api/fast-login", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); } catch (e) {}
    return c.noContent(204);
});

console.log("[FAST_LOGIN] hook loaded: POST /api/fast-login");


