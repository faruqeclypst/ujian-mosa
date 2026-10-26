// pb_hooks/student_fields_sync.pb.js
// Auto-ensure student profile fields (photo, birthPlace, birthDate, room, session, examNumber)
onBootstrap((e) => {
    e.next();
    try {
        const db = $app.db();
        const requiredCols = [
            "photo",
            "birthPlace",
            "birthDate",
            "room",
            "session",
            "examNumber",
            "fastHash",
            "resetRequested"
        ];
        
        for (let i = 0; i < requiredCols.length; i++) {
            const colName = requiredCols[i];
            try {
                db.newQuery("ALTER TABLE students ADD COLUMN " + colName + " TEXT DEFAULT '' NOT NULL").execute();
            } catch (x) {
                // Column likely already exists
            }
        }

        try {
            const collection = $app.findCollectionByNameOrId("students");
            if (collection) {
                let modified = false;
                for (let i = 0; i < requiredCols.length; i++) {
                    const colName = requiredCols[i];
                    if (!collection.fields.getByName(colName)) {
                        const tf = new TextField();
                        tf.name = colName;
                        tf.required = false;
                        collection.fields.add(tf);
                        modified = true;
                    }
                }
                if (modified) {
                    $app.save(collection);
                    console.log("[STUDENT_SYNC] Ensured profile fields in students collection");
                }
            }
        } catch (errCol) {
            // Notice only
        }

        // Auto-ensure group_name in exam_rooms & exams
        try {
            try { db.newQuery("ALTER TABLE exam_rooms ADD COLUMN group_name TEXT DEFAULT ''").execute(); } catch (_) {}
            try { db.newQuery("ALTER TABLE exams ADD COLUMN group_name TEXT DEFAULT ''").execute(); } catch (_) {}

            const erCol = $app.findCollectionByNameOrId("exam_rooms");
            if (erCol && !erCol.fields.getByName("group_name")) {
                const tf = new TextField();
                tf.name = "group_name";
                tf.required = false;
                tf.max = 150;
                erCol.fields.add(tf);
                $app.save(erCol);
                console.log("[SCHEMA_SYNC] Ensured group_name field in exam_rooms collection");
            }

            const exCol = $app.findCollectionByNameOrId("exams");
            if (exCol && !exCol.fields.getByName("group_name")) {
                const tf = new TextField();
                tf.name = "group_name";
                tf.required = false;
                tf.max = 150;
                exCol.fields.add(tf);
                $app.save(exCol);
                console.log("[SCHEMA_SYNC] Ensured group_name field in exams collection");
            }
        } catch (errGroup) {
            // Notice only
        }

        try {
            const attemptsCols = [
                { name: "objectiveScore", sql: "ALTER TABLE attempts ADD COLUMN objectiveScore REAL DEFAULT 0" },
                { name: "objectiveCorrect", sql: "ALTER TABLE attempts ADD COLUMN objectiveCorrect REAL DEFAULT 0" },
                { name: "objectiveTotal", sql: "ALTER TABLE attempts ADD COLUMN objectiveTotal INTEGER DEFAULT 0" },
                { name: "answeredCount", sql: "ALTER TABLE attempts ADD COLUMN answeredCount INTEGER DEFAULT 0" }
            ];
            for (let i = 0; i < attemptsCols.length; i++) {
                try { db.newQuery(attemptsCols[i].sql).execute(); } catch (_) {}
            }
            const attemptsCol = $app.findCollectionByNameOrId("attempts");
            if (attemptsCol) {
                let modAttempts = false;
                for (let i = 0; i < attemptsCols.length; i++) {
                    const cName = attemptsCols[i].name;
                    if (!attemptsCol.fields.getByName(cName)) {
                        const nf = new NumberField();
                        nf.name = cName;
                        nf.required = false;
                        attemptsCol.fields.add(nf);
                        modAttempts = true;
                    }
                }
                if (modAttempts) {
                    $app.save(attemptsCol);
                    console.log("[ATTEMPTS_SYNC] Ensured score & answeredCount fields in attempts collection");
                }
            }
        } catch (errAtt) {
            // Notice only
        }

        try {
            const usersCol = $app.findCollectionByNameOrId("users");
            if (usersCol) {
                let modUsers = false;
                const targetViewRule = 'id = @request.auth.id || @request.auth.role = "admin"';
                if (usersCol.viewRule !== targetViewRule) {
                    usersCol.viewRule = targetViewRule;
                    modUsers = true;
                    console.log("[USER_SYNC] Ensured viewRule on users collection: " + targetViewRule);
                }
                const avField = usersCol.fields.getByName("avatar_url");
                if (avField && (!avField.max || avField.max < 3000000)) {
                    avField.max = 3000000;
                    modUsers = true;
                    console.log("[USER_SYNC] Ensured users.avatar_url max length: 3000000");
                }
                if (modUsers) {
                    $app.save(usersCol);
                }
            }
        } catch (errUser) {
            // Notice only
        }

        // Auto-ensure max character limits on text fields for offline Data URLs / image uploads
        try {
            const settingsCol = $app.findCollectionByNameOrId("settings");
            if (settingsCol) {
                let modSettings = false;
                const lField = settingsCol.fields.getByName("logo");
                if (lField && (!lField.max || lField.max < 3000000)) {
                    lField.max = 3000000;
                    modSettings = true;
                }
                const luField = settingsCol.fields.getByName("logoUrl");
                if (luField && (!luField.max || luField.max < 3000000)) {
                    luField.max = 3000000;
                    modSettings = true;
                }
                if (modSettings) {
                    $app.save(settingsCol);
                    console.log("[SCHEMA_SYNC] Ensured settings.logo & logoUrl max length: 3000000");
                }
            }
        } catch (errSet) {
            // Notice only
        }

        try {
            const studentsCol = $app.findCollectionByNameOrId("students");
            if (studentsCol) {
                const photoField = studentsCol.fields.getByName("photo");
                if (photoField && (!photoField.max || photoField.max < 3000000)) {
                    photoField.max = 3000000;
                    $app.save(studentsCol);
                    console.log("[SCHEMA_SYNC] Ensured students.photo max length: 3000000");
                }
            }
        } catch (errPhoto) {
            // Notice only
        }

        // Auto-ensure all 12 question types are enabled by default in settings.allowed_types
        try {
            const sRecords = $app.findRecordsByFilter("settings", "1=1", "+created", 1);
            if (sRecords && sRecords.length > 0) {
                const sRec = sRecords[0];
                let currentAllowed = sRec.get("allowed_types");
                if (typeof currentAllowed === "string") {
                    try { currentAllowed = JSON.parse(currentAllowed); } catch(_) { currentAllowed = {}; }
                }
                if (!currentAllowed || typeof currentAllowed !== "object") currentAllowed = {};

                const ALL_TYPES = [
                    "pilihan_ganda", "pilihan_ganda_kompleks", "menjodohkan", "benar_salah",
                    "isian_singkat", "urutkan", "drag_drop", "uraian", "klasifikasi",
                    "hotspot", "isian_rumpang", "matriks"
                ];
                let changed = false;
                for (let i = 0; i < ALL_TYPES.length; i++) {
                    const t = ALL_TYPES[i];
                    if (currentAllowed[t] === undefined) {
                        currentAllowed[t] = true;
                        changed = true;
                    }
                }
                if (changed) {
                    sRec.set("allowed_types", currentAllowed);
                    $app.save(sRec);
                    console.log("[SETTINGS_SYNC] Ensured all 12 question types enabled in settings.allowed_types");
                }
            }
        } catch (errAllowed) {
            // Notice only
        }
    } catch (e) {
        console.warn("[STUDENT_SYNC] Bootstrap notice:", e);
    }
});
