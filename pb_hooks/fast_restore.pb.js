// ============================================================
// FAST RESTORE — Server-Side Bulk Database Restore (v1)
// - Menerima dump JSON backup dari pengaturan
// - Mengeksekusi seluruh create / update dalam $app.runInTransaction()
// - Menggunakan saveNoValidate() untuk performa maksimal dan
//   menghindari kegagalan validasi parsial
// - Autentikasi ketat: hanya admin (users) & superuser
// ============================================================

routerAdd("OPTIONS", "/api/fast-restore", (c) => {
    try { c.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
    try { c.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    return c.noContent(204);
});

routerAdd("POST", "/api/fast-restore", (c) => {
    function setCors(cc) {
        try { cc.setResponseHeader("Access-Control-Allow-Origin", "*"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); } catch (e) {}
        try { cc.setResponseHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, Authorization"); } catch (e) {}
    }

    setCors(c);

    function getAuth(info) {
        try {
            if (info && info.auth) return info.auth;
            const headers = info ? (info.headers || {}) : {};
            let token = headers["authorization"] || headers["x-token"] || "";
            if (typeof token === "string" && token.indexOf("Bearer ") === 0) {
                token = token.substring(7).trim();
            }
            if (token) {
                return $app.findAuthRecordByToken(token);
            }
        } catch (e) {}
        return null;
    }

    const info = c.requestInfo();
    const auth = getAuth(info);

    if (!auth) {
        return c.json(401, { error: "Autentikasi diperlukan." });
    }

    let authCol = "";
    try {
        if (auth.collection) authCol = auth.collection().name;
    } catch (e) {}

    if (authCol !== "_superusers" && authCol !== "users") {
        return c.json(403, { error: "Akses ditolak. Hanya administrator yang dapat memulihkan database." });
    }

    const startTime = Date.now();
    const body = info.body || {};
    const backupData = body.data || body;

    const priorityCollections = [
        "users",
        "settings",
        "classes",
        "subjects",
        "teachers",
        "students",
        "exams",
        "questions",
        "exam_rooms",
        "attempts"
    ];

    let totalRestored = 0;
    const details = {};

    try {
        $app.runInTransaction((txApp) => {
            for (let i = 0; i < priorityCollections.length; i++) {
                const colName = priorityCollections[i];
                const list = backupData[colName];
                if (!list || !Array.isArray(list) || list.length === 0) continue;

                let colModel = null;
                try {
                    colModel = txApp.findCollectionByNameOrId(colName);
                } catch (err) {
                    continue;
                }

                let colCount = 0;

                for (let j = 0; j < list.length; j++) {
                    const item = list[j];
                    if (!item || typeof item !== "object") continue;

                    const id = item.id;
                    if (!id) continue;

                    const cleanData = {};
                    const keys = Object.keys(item);
                    for (let k = 0; k < keys.length; k++) {
                        const key = keys[k];
                        if (
                            key === "id" ||
                            key === "created" ||
                            key === "updated" ||
                            key === "collectionId" ||
                            key === "collectionName" ||
                            key === "expand" ||
                            key.indexOf("@") === 0
                        ) {
                            continue;
                        }
                        if (colName === "settings" && (key === "universal_token" || key === "universal_token_updated_at")) {
                            continue;
                        }
                        cleanData[key] = item[key];
                    }

                    let record = null;
                    let isNew = false;

                    if (colName === "settings") {
                        try {
                            record = txApp.findFirstRecordByFilter("settings", "1=1");
                        } catch (e) {
                            record = null;
                        }
                    }

                    if (!record) {
                        try {
                            record = txApp.findRecordById(colModel, id);
                        } catch (e) {
                            record = null;
                        }
                    }

                    if (!record) {
                        isNew = true;
                        record = new Record(colModel, { id: id });
                    }

                    record.load(cleanData);

                    if (isNew && (colName === "students" || colName === "users")) {
                        const defaultPass = cleanData.password || "12345678";
                        try {
                            record.setPassword(defaultPass);
                        } catch (pErr) {}
                    }

                    try {
                        txApp.saveNoValidate(record);
                        colCount++;
                        totalRestored++;
                    } catch (saveErr) {
                        console.error("[FAST-RESTORE SAVE ERROR] " + colName + "/" + id + ": " + saveErr);
                    }
                }

                details[colName] = colCount;
            }

            const allKeys = Object.keys(backupData);
            for (let i = 0; i < allKeys.length; i++) {
                const colName = allKeys[i];
                if (priorityCollections.indexOf(colName) !== -1) continue;
                const list = backupData[colName];
                if (!list || !Array.isArray(list) || list.length === 0) continue;

                let colModel = null;
                try {
                    colModel = txApp.findCollectionByNameOrId(colName);
                } catch (err) {
                    continue;
                }

                let colCount = 0;
                for (let j = 0; j < list.length; j++) {
                    const item = list[j];
                    if (!item || typeof item !== "object") continue;
                    const id = item.id;
                    if (!id) continue;

                    const cleanData = {};
                    const keys = Object.keys(item);
                    for (let k = 0; k < keys.length; k++) {
                        const key = keys[k];
                        if (
                            key === "id" ||
                            key === "created" ||
                            key === "updated" ||
                            key === "collectionId" ||
                            key === "collectionName" ||
                            key === "expand" ||
                            key.indexOf("@") === 0
                        ) {
                            continue;
                        }
                        cleanData[key] = item[key];
                    }

                    let record = null;
                    try {
                        record = txApp.findRecordById(colModel, id);
                    } catch (e) {
                        record = null;
                    }

                    if (!record) {
                        record = new Record(colModel, { id: id });
                    }

                    record.load(cleanData);
                    try {
                        txApp.saveNoValidate(record);
                        colCount++;
                        totalRestored++;
                    } catch (saveErr) {}
                }
                details[colName] = colCount;
            }
        });

        const elapsedMs = Date.now() - startTime;
        console.log("[FAST-RESTORE] Berhasil memulihkan " + totalRestored + " data dalam " + elapsedMs + "ms");

        return c.json(200, {
            success: true,
            total: totalRestored,
            elapsed_ms: elapsedMs,
            details: details
        });
    } catch (txErr) {
        console.error("[FAST-RESTORE TX ERROR]: " + txErr);
        return c.json(500, {
            error: "Gagal memproses transaksi pemulihan: " + txErr
        });
    }
});
