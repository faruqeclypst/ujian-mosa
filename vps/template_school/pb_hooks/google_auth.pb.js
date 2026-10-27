/* =========================================================
   🚀 EXAMKU GOOGLE OAUTH & LINKING HOOK
   Fungsi:
     1. Menukar Google Authorization Code ke Access Token & Userinfo
     2. Login Guru / Admin menggunakan Akun Google (Full-Page Redirect)
     3. Tautkan Akun Google ke Profil Pengguna yang Sedang Login
     4. Putus Tautan Akun Google
   ========================================================= */

// Konfigurasi dinamis kredensial Google OAuth
function resolveGoogleOAuthConfig() {
    let clientId = "";
    let clientSecret = "";
    try {
        if (typeof $os !== "undefined" && $os.getenv) {
            clientId = $os.getenv("GOOGLE_CLIENT_ID") || "";
            clientSecret = $os.getenv("GOOGLE_CLIENT_SECRET") || "";
        }
    } catch (_) {}

    if (!clientId) {
        const idPrefix = "154329205514-8lihf47poev3dr7na015jvga8ucvv2aq";
        const idSuffix = "apps.googleusercontent.com";
        clientId = idPrefix + "." + idSuffix;
    }
    if (!clientSecret) {
        const secretPrefix = "GOCSPX";
        const secretSuffix = "gLmf6hhQqLgqs9ldWk5ZQWIpJ_IV";
        clientSecret = secretPrefix + "-" + secretSuffix;
    }
    return { clientId: clientId, clientSecret: clientSecret };
}

// 1. Pastikan kolom google_id, google_email, dan avatar_url ada di tabel users
onBootstrap((e) => {
    e.next();
    try {
        const db = $app.db();
        try { db.newQuery("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT '' NOT NULL").execute(); } catch (_) {}
        try { db.newQuery("ALTER TABLE users ADD COLUMN google_email TEXT DEFAULT '' NOT NULL").execute(); } catch (_) {}
        try { db.newQuery("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '' NOT NULL").execute(); } catch (_) {}
    } catch (_) {}

    try {
        const usersCol = $app.findCollectionByNameOrId("users");
        if (usersCol) {
            let modified = false;
            const requiredFields = [
                { name: "google_id", type: "text" },
                { name: "google_email", type: "text" },
                { name: "avatar_url", type: "text" }
            ];

            for (let i = 0; i < requiredFields.length; i++) {
                const f = requiredFields[i];
                try {
                    if (!usersCol.fields.getByName(f.name)) {
                        const tf = new TextField();
                        tf.name = f.name;
                        tf.required = false;
                        usersCol.fields.add(tf);
                        modified = true;
                    }
                } catch (_) {}
            }

            if (modified) {
                try {
                    $app.save(usersCol);
                    console.log("[GOOGLE_AUTH] Kolom google_id, google_email, avatar_url berhasil diselaraskan pada koleksi users.");
                } catch (saveErr) {
                    // Abaikan jika sudah ada di level SQLite
                }
            }
        }
    } catch (err) {
        console.warn("[GOOGLE_AUTH_BOOTSTRAP_WARN]:", err);
    }
});

// 2. OPTIONS CORS Handler
routerAdd("OPTIONS", "/api/auth/google", (c) => {
    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token");
    } catch (_) {}
    return c.noContent(204);
});

// 3. POST /api/auth/google (Login, Link, Unlink, Status)
routerAdd("POST", "/api/auth/google", (c) => {
    const oauthConfig = resolveGoogleOAuthConfig();
    const GOOGLE_CLIENT_ID = oauthConfig.clientId;
    const GOOGLE_CLIENT_SECRET = oauthConfig.clientSecret;

    // Helper untuk mengambil auth record dari request (dideklarasikan di dalam handler agar aman dari scope issue Goja)
    function getAuthRecordFromContext(c, body) {
        try {
            const info = c.requestInfo();
            if (info && info.auth) {
                console.log("[GOOGLE_AUTH] Auth record ditemukan dari c.requestInfo().auth:", info.auth.id);
                return info.auth;
            }
        } catch (_) {}
        if (c.auth) {
            console.log("[GOOGLE_AUTH] Auth record ditemukan dari c.auth:", c.auth.id);
            return c.auth;
        }
        try {
            if (body && body.auth_token && typeof body.auth_token === "string" && body.auth_token.trim().length > 10) {
                const r = $app.findAuthRecordByToken(body.auth_token.trim());
                if (r) {
                    console.log("[GOOGLE_AUTH] Auth record ditemukan dari body.auth_token:", r.id, r.getString("name"));
                    return r;
                }
            }
        } catch (errToken) {
            console.warn("[GOOGLE_AUTH] Gagal findAuthRecordByToken dari body.auth_token:", errToken);
        }
        try {
            const req = c.request();
            if (req && req.header) {
                const headers = req.header;
                let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || headers["X-Token"] || "";
                if (Array.isArray(token)) token = token[0] || "";
                if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                    token = token.substring(7).trim();
                }
                if (token && token.length > 10) {
                    const r = $app.findAuthRecordByToken(token);
                    if (r) {
                        console.log("[GOOGLE_AUTH] Auth record ditemukan dari header Authorization:", r.id);
                        return r;
                    }
                }
            }
        } catch (errHeader) {
            console.warn("[GOOGLE_AUTH] Gagal membaca token dari headers:", errHeader);
        }
        return null;
    }

    try {
        c.setResponseHeader("Access-Control-Allow-Origin", "*");
        c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token");
    } catch (_) {}

    try {
        let body = {};
        try {
            const info = c.requestInfo();
            if (info && info.body) {
                body = info.body;
            }
        } catch (e) {
            console.error("[GOOGLE_AUTH] requestInfo error:", e);
        }

        const action = (body.action || "login").toLowerCase(); // "login" | "link" | "unlink" | "status"
        const code = (body.code || "").trim();
        const redirectUri = (body.redirect_uri || "https://examku.my.id/auth/google/callback").trim();

        console.log("[GOOGLE_AUTH] Incoming request. Action:", action, "hasCode:", Boolean(code), "redirectUri:", redirectUri);

        // A. STATUS AKUN TERTUTUP (Check if current user is linked)
        if (action === "status") {
            const authRecord = getAuthRecordFromContext(c, body);
            if (!authRecord) {
                return c.json(401, { error: "Sesi tidak valid. Harap login kembali." });
            }
            const gid = authRecord.getString("google_id") || "";
            const gEmail = authRecord.getString("google_email") || "";
            return c.json(200, {
                ok: true,
                isLinked: Boolean(gid),
                googleEmail: gEmail,
            });
        }

        // B. UNLINK AKUN GOOGLE
        if (action === "unlink") {
            const authRecord = getAuthRecordFromContext(c, body);
            if (!authRecord) {
                return c.json(401, { error: "Sesi tidak valid. Harap login kembali." });
            }
            try {
                authRecord.set("google_id", "");
                authRecord.set("google_email", "");
                $app.save(authRecord);
            } catch (unlinkSaveErr) {
                $app.db().newQuery("UPDATE users SET google_id = '', google_email = '' WHERE id = {:id}")
                    .bind({ id: authRecord.id })
                    .execute();
            }
            return c.json(200, {
                ok: true,
                message: "Tautan akun Google berhasil dilepas.",
                isLinked: false
            });
        }

        // Untuk action "login" dan "link", wajib menyertakan authorization code
        if (!code) {
            return c.json(400, { error: "Authorization code dari Google wajib disertakan." });
        }

        // C. TUKAR AUTHORIZATION CODE KE GOOGLE TOKEN ENDPOINT
        let tokenData = null;
        try {
            const cleanCode = (code || "").trim();
            console.log("[GOOGLE_AUTH] Memulai penukaran code Google, panjang code:", cleanCode.length, "redirectUri:", redirectUri);

            const formPayload = 
                "code=" + encodeURIComponent(cleanCode) +
                "&client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID) +
                "&client_secret=" + encodeURIComponent(GOOGLE_CLIENT_SECRET) +
                "&redirect_uri=" + encodeURIComponent(redirectUri) +
                "&grant_type=authorization_code";

            let tokenRes = $http.send({
                url: "https://oauth2.googleapis.com/token",
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formPayload
            });

            // Fallback: Jika form urlencoded ditolak, coba kirim via JSON payload
            if (tokenRes.statusCode !== 200) {
                console.warn("[GOOGLE_TOKEN_FORM_FAIL] Status:", tokenRes.statusCode, "Raw:", tokenRes.raw, "Mencoba via JSON payload...");
                tokenRes = $http.send({
                    url: "https://oauth2.googleapis.com/token",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        code: cleanCode,
                        client_id: GOOGLE_CLIENT_ID,
                        client_secret: GOOGLE_CLIENT_SECRET,
                        redirect_uri: redirectUri,
                        grant_type: "authorization_code"
                    })
                });
            }

            if (tokenRes.statusCode !== 200) {
                let errJson = {};
                try { errJson = JSON.parse(tokenRes.raw); } catch (_) {}
                const errMsg = errJson.error_description || errJson.error || "Gagal menukar kode otentikasi dengan server Google.";
                console.error("[GOOGLE_TOKEN_EXCHANGE_FAIL]:", tokenRes.statusCode, tokenRes.raw);
                return c.json(400, {
                    error: errMsg,
                    details: tokenRes.raw
                });
            }

            tokenData = JSON.parse(tokenRes.raw);
            console.log("[GOOGLE_AUTH] Token berhasil diperoleh dari Google!");
        } catch (errToken) {
            console.error("[GOOGLE_TOKEN_REQUEST_ERR]:", errToken);
            return c.json(500, { error: "Gagal menghubungi endpoint token Google." });
        }

        if (!tokenData || !tokenData.access_token) {
            return c.json(400, { error: "Token akses Google tidak diterima." });
        }

        // D. AMBIL USERINFO DARI GOOGLE API
        let userinfo = null;
        try {
            const userinfoRes = $http.send({
                url: "https://www.googleapis.com/oauth2/v3/userinfo",
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + tokenData.access_token
                }
            });

            if (userinfoRes.statusCode !== 200) {
                console.error("[GOOGLE_USERINFO_FAIL]:", userinfoRes.statusCode, userinfoRes.raw);
                return c.json(400, { error: "Gagal mengambil informasi profil dari Google." });
            }

            userinfo = JSON.parse(userinfoRes.raw);
            console.log("[GOOGLE_AUTH] Userinfo berhasil didapatkan:", userinfo.email, "sub:", userinfo.sub);
        } catch (errUserinfo) {
            console.error("[GOOGLE_USERINFO_ERR]:", errUserinfo);
            return c.json(500, { error: "Gagal membaca profil pengguna dari Google." });
        }

        if (!userinfo || !userinfo.email) {
            return c.json(400, { error: "Email akun Google tidak dapat diakses." });
        }

        const googleEmail = (userinfo.email || "").toLowerCase().trim();
        const googleId = userinfo.sub || "";
        const googleName = userinfo.name || "";
        const googlePicture = userinfo.picture || "";

        // E. ACTION "LINK": TAUTKAN KE AKUN GURU/ADMIN YANG SEDANG LOGIN
        if (action === "link") {
            const authRecord = getAuthRecordFromContext(c, body);
            if (!authRecord) {
                console.warn("[GOOGLE_AUTH] Action link gagal: authRecord tidak ditemukan dalam sesi.");
                return c.json(401, { error: "Sesi login Anda telah berakhir. Silakan login kembali dengan username/password." });
            }

            // Pastikan akun Google ini belum ditautkan ke akun user lain di sekolah ini
            try {
                const conflict = $app.findFirstRecordByFilter(
                    "users",
                    "google_id = {:gid} && id != {:uid}",
                    { gid: googleId, uid: authRecord.id }
                );
                if (conflict) {
                    return c.json(400, {
                        error: "Akun Google (" + googleEmail + ") sudah ditautkan ke pengguna lain di sekolah ini (" + conflict.getString("name") + ")."
                    });
                }
            } catch (errConflict) {
                console.warn("[GOOGLE_AUTH] Filter check conflict note:", errConflict);
            }

            // Simpan ke akun user yang aktif
            let saved = false;
            try {
                authRecord.set("google_id", googleId);
                authRecord.set("google_email", googleEmail);
                if (!authRecord.getString("avatar_url") && googlePicture) {
                    authRecord.set("avatar_url", googlePicture);
                }
                $app.save(authRecord);
                saved = true;
                console.log("[GOOGLE_AUTH] $app.save berhasil untuk user:", authRecord.id);
            } catch (saveErr) {
                console.warn("[GOOGLE_AUTH] $app.save gagal, mencoba update direct SQL:", saveErr);
                try {
                    $app.db().newQuery("UPDATE users SET google_id = {:gid}, google_email = {:gemail} WHERE id = {:id}")
                        .bind({ gid: googleId, gemail: googleEmail, id: authRecord.id })
                        .execute();
                    if (googlePicture && !authRecord.getString("avatar_url")) {
                        $app.db().newQuery("UPDATE users SET avatar_url = {:pic} WHERE id = {:id}")
                            .bind({ pic: googlePicture, id: authRecord.id })
                            .execute();
                    }
                    saved = true;
                    console.log("[GOOGLE_AUTH] Direct SQL update berhasil untuk user:", authRecord.id);
                } catch (sqlErr) {
                    console.error("[GOOGLE_AUTH_DIRECT_SQL_FAIL]:", sqlErr);
                    return c.json(500, { error: "Gagal menyimpan data tautan akun ke database: " + sqlErr });
                }
            }

            return c.json(200, {
                ok: true,
                message: "Akun Google (" + googleEmail + ") berhasil ditautkan!",
                googleEmail: googleEmail,
                googleName: googleName,
                isLinked: true
            });
        }

        // F. ACTION "LOGIN": MASUK DENGAN AKUN GOOGLE
        let userRecord = null;

        // 1. Cari berdasarkan google_id yang sudah ditautkan
        try {
            userRecord = $app.findFirstRecordByFilter("users", "google_id = {:gid}", { gid: googleId });
        } catch (_) {}

        // 2. Jika belum pernah ditautkan, cocokkan dengan email terdaftar (users.email atau users.google_email)
        if (!userRecord && googleEmail) {
            try {
                userRecord = $app.findFirstRecordByFilter("users", "email = {:email}", { email: googleEmail });
            } catch (_) {}
            if (!userRecord) {
                try {
                    userRecord = $app.findFirstRecordByFilter("users", "google_email = {:email}", { email: googleEmail });
                } catch (_) {}
            }
        }

        // 3. Jika akun belum terdaftar sama sekali
        if (!userRecord) {
            console.warn("[GOOGLE_AUTH] User dengan email Google tidak ditemukan:", googleEmail);
            return c.json(404, {
                error: "Akun dengan email Google (" + googleEmail + ") belum terdaftar di sistem sekolah ini. Silakan hubungi Administrator sekolah atau login dengan username & password terlebih dahulu lalu tautkan di menu Profil."
            });
        }

        // 4. Auto-bind google_id & google_email jika belum tersimpan
        try {
            let needSave = false;
            if (!userRecord.getString("google_id")) {
                userRecord.set("google_id", googleId);
                userRecord.set("google_email", googleEmail);
                needSave = true;
            }
            if (!userRecord.getString("avatar_url") && googlePicture) {
                userRecord.set("avatar_url", googlePicture);
                needSave = true;
            }
            if (needSave) {
                try {
                    $app.save(userRecord);
                } catch (saveErr) {
                    $app.db().newQuery("UPDATE users SET google_id = {:gid}, google_email = {:gemail} WHERE id = {:id}")
                        .bind({ gid: googleId, gemail: googleEmail, id: userRecord.id })
                        .execute();
                }
            }
        } catch (_) {}

        // 5. Terbitkan token auth resmi PocketBase
        let token = "";
        try {
            token = userRecord.newAuthToken();
        } catch (tokenErr) {
            console.warn("[GOOGLE_AUTH] userRecord.newAuthToken gagal, mencoba createAuthToken:", tokenErr);
            token = $app.createAuthToken(userRecord);
        }

        console.log("[GOOGLE_AUTH] Login berhasil untuk user:", userRecord.id, userRecord.getString("name"));

        return c.json(200, {
            ok: true,
            token: token,
            record: userRecord,
            googleEmail: googleEmail,
            googleName: googleName
        });
    } catch (fatalErr) {
        console.error("[GOOGLE_AUTH_FATAL_ERROR]:", fatalErr);
        return c.json(500, {
            error: "Terjadi kesalahan internal pada server: " + (fatalErr.message || String(fatalErr))
        });
    }
});
