// pb_hooks/shared_gallery.pb.js
// Galeri Media Bersama untuk Guru & Admin
// Menyediakan endpoint terpadu agar seluruh guru di sekolah dapat saling berbagi gambar soal,
// diagram edukasi, dan materi visual yang pernah diunggah di sekolah.
//
// PENTING: Semua helper function harus inline di dalam handler callback
// karena binding top-level tidak terbawa ke scope callback Goja di PocketBase.

onBootstrap((e) => {
    e.next();
    try {
        $app.db().newQuery(`
            CREATE TABLE IF NOT EXISTS shared_gallery (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                title TEXT DEFAULT '',
                teacherId TEXT DEFAULT '',
                teacherName TEXT DEFAULT '',
                examTitle TEXT DEFAULT '',
                created TEXT DEFAULT ''
            )
        `).execute();
    } catch (_) {}
    try {
        $app.db().newQuery("CREATE INDEX IF NOT EXISTS idx_sg_teacher ON shared_gallery(teacherId)").execute();
    } catch (_) {}
});

routerAdd("OPTIONS", "/api/shared-gallery", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("OPTIONS", "/api/search-web-images", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (_) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    return c.noContent(204);
});

routerAdd("GET", "/api/search-web-images", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    }

    try {
        setCors(c);
        const info = c.requestInfo();
        const queryParams = (info && info.query) ? info.query : {};
        const q = (queryParams["q"] || "").toString().trim();
        const count = parseInt(queryParams["count"] || "24", 10) || 24;

        if (!q) {
            return c.json(200, { results: [] });
        }

        // Bing image search endpoint
        const bingUrl = "https://www.bing.com/images/async?q=" + encodeURIComponent(q) + "&first=1&count=" + count + "&scenario=ImageBasicHover&datsrc=N_I&layout=RowBased&mmasync=1";

        const res = $http.send({
            url: bingUrl,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
            },
            timeout: 10
        });

        if (res.statusCode < 200 || res.statusCode >= 400) {
            return c.json(res.statusCode, { error: "Gagal mengambil data dari mesin pencari gambar (status " + res.statusCode + ")" });
        }

        const html = res.raw || (typeof res.body === "string" ? res.body : "");
        const results = [];
        const mRegex = /m="(\{[^"]+\})"/g;
        let match;

        while ((match = mRegex.exec(html)) !== null && results.length < count) {
            try {
                const rawJson = match[1].split("&quot;").join('"').split("&amp;").join('&');
                const data = JSON.parse(rawJson);
                if (data && data.murl) {
                    const cleanTitle = (data.desc || data.t || q).replace(/[\uE000-\uF8FF]/g, '').trim();
                    results.push({
                        id: "web_" + results.length + "_" + (data.cid || Math.random().toString(36).substring(2, 7)),
                        title: cleanTitle,
                        imageUrl: data.murl,
                        thumbUrl: data.turl || data.murl,
                        sourcePage: data.purl || "",
                        width: data.w || 0,
                        height: data.h || 0,
                        source: "web"
                    });
                }
            } catch (_) {}
        }

        return c.json(200, {
            query: q,
            count: results.length,
            results: results
        });
    } catch (err) {
        return c.json(500, { error: "Terjadi kesalahan internal: " + err });
    }
});

routerAdd("GET", "/api/shared-gallery", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    }

    function getAuth(info) {
        try {
            if (info && info.auth) return info.auth;
            const headers = info ? (info.headers || {}) : {};
            let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || "";
            if (Array.isArray(token)) token = token[0] || "";
            if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                token = token.substring(7);
            }
            if (token) {
                return $app.findAuthRecordByToken(token);
            }
        } catch (_) {}
        return null;
    }

    try {
        setCors(c);
        const info = c.requestInfo();
        const auth = getAuth(info);
        if (!auth) {
            return c.json(401, { error: "Login diperlukan untuk membuka galeri." });
        }

        let col = "";
        try { if (auth.collection) col = auth.collection().name; } catch (_) {}
        if (col !== "_superusers" && col !== "users") {
            return c.json(403, { error: "Akses ditolak: hanya guru dan admin." });
        }

        let callerTeacherId = "";
        let callerRole = "teacher";
        try {
            callerRole = auth.getString ? auth.getString("role") : (auth.role || "teacher");
            callerTeacherId = auth.getString ? auth.getString("teacherId") : (auth.teacherId || "");
        } catch (_) {}

        const queryParams = (info && info.query) ? info.query : {};
        const filterTeacher = (queryParams["teacherId"] || "").toString().trim();
        const filterSearch = (queryParams["search"] || "").toString().trim().toLowerCase();

        const imageMap = {};
        const teacherMap = {};

        // 1. Ambil dari tabel shared_gallery eksplisit
        try {
            const tplSg = new DynamicModel({
                id: "",
                url: "",
                title: "",
                teacherId: "",
                teacherName: "",
                examTitle: "",
                created: ""
            });
            const sgRows = arrayOf(tplSg);
            $app.db().newQuery("SELECT id, url, title, teacherId, teacherName, examTitle, created FROM shared_gallery ORDER BY created DESC LIMIT 200").all(sgRows);
            for (let i = 0; i < sgRows.length; i++) {
                const r = sgRows[i];
                const url = (r.url || "").trim();
                if (!url) continue;
                const tId = r.teacherId || "";
                const tName = r.teacherName || "Admin / Sistem";
                const eTitle = r.examTitle || "";
                const isOwn = (callerRole === "admin") || (callerTeacherId && tId === callerTeacherId);
                imageMap[url] = {
                    id: r.id || ("sg_" + i),
                    url: url,
                    title: r.title || eTitle || "Media Unggahan",
                    teacherId: tId,
                    teacherName: tName,
                    examTitle: eTitle,
                    created: r.created || "",
                    count: 1,
                    isOwn: !!isOwn,
                    source: "gallery"
                };
                if (tId) {
                    if (!teacherMap[tId]) teacherMap[tId] = { id: tId, name: tName, count: 0 };
                    teacherMap[tId].count++;
                }
            }
        } catch (err) {
            console.warn("[SHARED_GALLERY] Query shared_gallery notice:", err);
        }

        // 2. Ambil dari tabel questions & exams & teachers
        try {
            const tplQ = new DynamicModel({
                id: "",
                examId: "",
                imageUrl: "",
                text: "",
                options: "",
                choices: "",
                created: "",
                examTitle: "",
                teacherId: "",
                teacherName: ""
            });
            const qRows = arrayOf(tplQ);
            $app.db().newQuery(`
                SELECT 
                    q.id,
                    COALESCE(q.examId, '') AS examId,
                    COALESCE(q.imageUrl, '') AS imageUrl,
                    COALESCE(q.text, '') AS text,
                    COALESCE(q.options, '') AS options,
                    COALESCE(q.choices, '') AS choices,
                    COALESCE(q.created, '') AS created,
                    COALESCE(e.title, '') AS examTitle,
                    COALESCE(e.teacherId, '') AS teacherId,
                    COALESCE(t.name, 'Admin / Sistem') AS teacherName
                FROM questions q
                LEFT JOIN exams e ON q.examId = e.id
                LEFT JOIN teachers t ON e.teacherId = t.id
                WHERE q.imageUrl != '' 
                   OR q.text LIKE '%<img%' 
                   OR q.options LIKE '%imageUrl%' 
                   OR q.choices LIKE '%imageUrl%'
                   OR q.options LIKE '%<img%' 
                   OR q.choices LIKE '%<img%'
                ORDER BY q.created DESC
                LIMIT 400
            `).all(qRows);

            function extractImagesFromHtml(html, cb) {
                if (!html || html.indexOf("<img") === -1) return;
                const re = /<img[^>]+src=["']([^"']+)["']/gi;
                let match;
                while ((match = re.exec(html)) !== null) {
                    if (match[1]) cb(match[1]);
                }
            }

            function extractImagesFromJson(jsonStr, cb) {
                if (!jsonStr) return;
                const reImg = /"imageUrl"\s*:\s*"([^"]+)"/g;
                let m;
                while ((m = reImg.exec(jsonStr)) !== null) {
                    if (m[1]) cb(m[1]);
                }
                extractImagesFromHtml(jsonStr, cb);
            }

            for (let i = 0; i < qRows.length; i++) {
                const q = qRows[i];
                const tId = q.teacherId || "";
                const tName = q.teacherName || (tId ? "Guru" : "Admin / Sistem");
                const eTitle = q.examTitle || "Soal Ujian";
                const isOwn = (callerRole === "admin") || (callerTeacherId && tId === callerTeacherId);

                function handleFoundUrl(rawUrl) {
                    if (!rawUrl) return;
                    const clean = rawUrl.trim();
                    if (clean.length < 5) return;
                    if (imageMap[clean]) {
                        imageMap[clean].count++;
                        return;
                    }
                    imageMap[clean] = {
                        id: "q_" + q.id + "_" + Object.keys(imageMap).length,
                        url: clean,
                        title: eTitle,
                        teacherId: tId,
                        teacherName: tName,
                        examTitle: eTitle,
                        created: q.created || "",
                        count: 1,
                        isOwn: !!isOwn,
                        source: "question"
                    };
                    if (tId) {
                        if (!teacherMap[tId]) teacherMap[tId] = { id: tId, name: tName, count: 0 };
                        teacherMap[tId].count++;
                    }
                }

                if (q.imageUrl) handleFoundUrl(q.imageUrl);
                extractImagesFromHtml(q.text, handleFoundUrl);
                extractImagesFromJson(q.options, handleFoundUrl);
                extractImagesFromJson(q.choices, handleFoundUrl);
            }
        } catch (err) {
            console.warn("[SHARED_GALLERY] Query questions notice:", err);
        }

        let allImages = Object.values(imageMap);

        if (filterTeacher && filterTeacher !== "all") {
            if (filterTeacher === "mine") {
                allImages = allImages.filter(img => img.isOwn);
            } else {
                allImages = allImages.filter(img => img.teacherId === filterTeacher);
            }
        }

        if (filterSearch) {
            allImages = allImages.filter(img => {
                return (img.title && img.title.toLowerCase().indexOf(filterSearch) !== -1) ||
                       (img.teacherName && img.teacherName.toLowerCase().indexOf(filterSearch) !== -1) ||
                       (img.examTitle && img.examTitle.toLowerCase().indexOf(filterSearch) !== -1);
            });
        }

        const teacherList = Object.values(teacherMap).sort((a, b) => b.count - a.count);

        return c.json(200, {
            images: allImages,
            teachers: teacherList,
            total: allImages.length,
            callerTeacherId: callerTeacherId,
            callerRole: callerRole
        });
    } catch (err) {
        console.error("[SHARED_GALLERY] Handler error:", err);
        return c.json(500, { error: "" + err });
    }
});

routerAdd("POST", "/api/shared-gallery", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"); } catch (_) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "*"); } catch (_) {}
    }

    function getAuth(info) {
        try {
            if (info && info.auth) return info.auth;
            const headers = info ? (info.headers || {}) : {};
            let token = headers["authorization"] || headers["Authorization"] || headers["x-token"] || "";
            if (Array.isArray(token)) token = token[0] || "";
            if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                token = token.substring(7);
            }
            if (token) {
                return $app.findAuthRecordByToken(token);
            }
        } catch (_) {}
        return null;
    }

    try {
        setCors(c);
        const info = c.requestInfo();
        const auth = getAuth(info);
        if (!auth) {
            return c.json(401, { error: "Login diperlukan." });
        }

        let callerTeacherId = "";
        let callerName = "";
        try {
            callerTeacherId = auth.getString ? auth.getString("teacherId") : (auth.teacherId || "");
            callerName = auth.getString ? auth.getString("name") : (auth.name || "");
        } catch (_) {}

        let body = {};
        try {
            body = info.body || {};
        } catch (e) {
            body = {};
        }

        const url = (body.url || "").trim();
        if (!url) {
            return c.json(400, { error: "URL gambar wajib diisi." });
        }

        const title = (body.title || "Gambar Galeri").trim();
        const examTitle = (body.examTitle || "Galeri Bersama").trim();
        const teacherName = callerName || (body.teacherName || "Guru");
        const teacherId = callerTeacherId || (body.teacherId || "");
        const now = new Date().toISOString();
        const id = "sg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

        $app.db().newQuery(`
            INSERT INTO shared_gallery (id, url, title, teacherId, teacherName, examTitle, created)
            VALUES ({:id}, {:url}, {:title}, {:teacherId}, {:teacherName}, {:examTitle}, {:created})
        `).bind({
            id: id,
            url: url,
            title: title,
            teacherId: teacherId,
            teacherName: teacherName,
            examTitle: examTitle,
            created: now
        }).execute();

        return c.json(200, {
            success: true,
            item: {
                id: id,
                url: url,
                title: title,
                teacherId: teacherId,
                teacherName: teacherName,
                examTitle: examTitle,
                created: now,
                count: 1,
                isOwn: true
            }
        });
    } catch (err) {
        return c.json(500, { error: "Gagal menyimpan ke galeri bersama: " + err });
    }
});
