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
            "resetRequested",
            "examUsername",
            "examPassword"
        ];
        
        for (let i = 0; i < requiredCols.length; i++) {
            const colName = requiredCols[i];
            try {
                db.newQuery("ALTER TABLE students ADD COLUMN " + colName + " TEXT DEFAULT '' NOT NULL").execute();
            } catch (x) {
                // Column likely already exists
            }
        }

        // Auto-ensure database performance indexes for fast table queries & CBT stability
        try {
            const perfIndexes = [
                "CREATE INDEX IF NOT EXISTS idx_students_examUsername ON students(examUsername)",
                "CREATE INDEX IF NOT EXISTS idx_students_classId ON students(classId)",
                "CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)",
                "CREATE INDEX IF NOT EXISTS idx_students_created ON students(created)",
                "CREATE INDEX IF NOT EXISTS idx_attempts_examRoomId ON attempts(examRoomId)",
                "CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status)",
                "CREATE INDEX IF NOT EXISTS idx_attempts_room_status ON attempts(examRoomId, status)",
                "CREATE INDEX IF NOT EXISTS idx_exam_rooms_status ON exam_rooms(status)",
                "CREATE INDEX IF NOT EXISTS idx_exam_rooms_examId ON exam_rooms(examId)",
                "CREATE INDEX IF NOT EXISTS idx_exam_rooms_created ON exam_rooms(created)",
                "CREATE INDEX IF NOT EXISTS idx_questions_examId ON questions(examId)",
                "CREATE INDEX IF NOT EXISTS idx_exams_created ON exams(created)",
                "CREATE INDEX IF NOT EXISTS idx_classes_created ON classes(created)"
            ];
            for (let i = 0; i < perfIndexes.length; i++) {
                try {
                    db.newQuery(perfIndexes[i]).execute();
                } catch (_) {}
            }
        } catch (_) {}

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
            if (erCol) {
                let modEr = false;
                if (!erCol.fields.getByName("group_name")) {
                    const tf = new TextField();
                    tf.name = "group_name";
                    tf.required = false;
                    tf.max = 150;
                    erCol.fields.add(tf);
                    modEr = true;
                    console.log("[SCHEMA_SYNC] Ensured group_name field in exam_rooms collection");
                }
                const targetErList = '(@request.auth.role = "admin") || (@request.auth.role = "teacher" && (examId.teacherId = @request.auth.teacherId || examId.teacherId = @request.auth.id || examId.is_mgmp_shared = true)) || (@request.auth.id != "" && @request.auth.role = "") || (@request.auth.collectionName = "students")';
                const targetErView = '(@request.auth.role = "admin") || (@request.auth.role = "teacher" && (examId.teacherId = @request.auth.teacherId || examId.teacherId = @request.auth.id || examId.is_mgmp_shared = true)) || (@request.auth.id != "" && @request.auth.role = "") || (@request.auth.collectionName = "students")';
                const targetErCreate = '(@request.auth.role = "admin") || (@request.auth.role = "teacher")';
                const targetErUp = '(@request.auth.role = "admin") || (@request.auth.role = "teacher" && (examId.teacherId = @request.auth.teacherId || examId.teacherId = @request.auth.id || examId.is_mgmp_shared = true))';
                const targetErDel = '(@request.auth.role = "admin") || (@request.auth.role = "teacher" && (examId.teacherId = @request.auth.teacherId || examId.teacherId = @request.auth.id || examId.is_mgmp_shared = true))';
                if (erCol.listRule !== targetErList) { erCol.listRule = targetErList; modEr = true; }
                if (erCol.viewRule !== targetErView) { erCol.viewRule = targetErView; modEr = true; }
                if (erCol.createRule !== targetErCreate) { erCol.createRule = targetErCreate; modEr = true; }
                if (erCol.updateRule !== targetErUp) { erCol.updateRule = targetErUp; modEr = true; }
                if (erCol.deleteRule !== targetErDel) { erCol.deleteRule = targetErDel; modEr = true; }
                if (modEr) {
                    try {
                        $app.save(erCol);
                        console.log("[SCHEMA_SYNC] Ensured rules in exam_rooms collection");
                    } catch (eSaveEr) {
                        db.newQuery("UPDATE _collections SET listRule = {:l}, viewRule = {:v}, createRule = {:c}, updateRule = {:u}, deleteRule = {:d} WHERE name = 'exam_rooms'")
                            .bind({ l: targetErList, v: targetErView, c: targetErCreate, u: targetErUp, d: targetErDel }).execute();
                    }
                }
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

            // Auto-ensure is_mgmp_shared in exams
            try { db.newQuery("ALTER TABLE exams ADD COLUMN is_mgmp_shared BOOLEAN DEFAULT 0").execute(); } catch (_) {}
            if (exCol) {
                let modEx = false;
                if (!exCol.fields.getByName("is_mgmp_shared")) {
                    const bf = new BoolField();
                    bf.name = "is_mgmp_shared";
                    bf.required = false;
                    exCol.fields.add(bf);
                    modEx = true;
                }
                const targetExList = '@request.auth.role = "admin" || @request.auth.role = "teacher" || teacherId = @request.auth.teacherId || @request.auth.collectionName = "students"';
                const targetExView = '@request.auth.role = "admin" || @request.auth.role = "teacher" || teacherId = @request.auth.teacherId || @request.auth.collectionName = "students"';
                const targetExUp = '@request.auth.role = "admin" || teacherId = @request.auth.teacherId || (is_mgmp_shared = true && @request.auth.role = "teacher")';
                if (exCol.listRule !== targetExList) { exCol.listRule = targetExList; modEx = true; }
                if (exCol.viewRule !== targetExView) { exCol.viewRule = targetExView; modEx = true; }
                if (exCol.updateRule !== targetExUp) { exCol.updateRule = targetExUp; modEx = true; }

                if (modEx) {
                    try {
                        $app.save(exCol);
                        console.log("[SCHEMA_SYNC] Ensured is_mgmp_shared and rules in exams collection");
                    } catch (eSave) {
                        db.newQuery("UPDATE _collections SET listRule = {:l}, viewRule = {:v}, updateRule = {:u} WHERE name = 'exams'")
                            .bind({ l: targetExList, v: targetExView, u: targetExUp }).execute();
                    }
                }
            }

            // Auto-ensure MGMP rules in questions
            const qCol = $app.findCollectionByNameOrId("questions");
            if (qCol) {
                let modQ = false;
                const targetQList = '@request.auth.collectionName = "students" || @request.auth.role = "admin" || @request.auth.role = "teacher" || examId.teacherId = @request.auth.teacherId';
                const targetQView = '@request.auth.collectionName = "students" || @request.auth.role = "admin" || @request.auth.role = "teacher" || examId.teacherId = @request.auth.teacherId';
                const targetQCreate = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")';
                const targetQUpdate = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")';
                const targetQDelete = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")';
                if (qCol.listRule !== targetQList) { qCol.listRule = targetQList; modQ = true; }
                if (qCol.viewRule !== targetQView) { qCol.viewRule = targetQView; modQ = true; }
                if (qCol.createRule !== targetQCreate) { qCol.createRule = targetQCreate; modQ = true; }
                if (qCol.updateRule !== targetQUpdate) { qCol.updateRule = targetQUpdate; modQ = true; }
                if (qCol.deleteRule !== targetQDelete) { qCol.deleteRule = targetQDelete; modQ = true; }
                if (modQ) {
                    try {
                        $app.save(qCol);
                        console.log("[SCHEMA_SYNC] Ensured MGMP collaboration rules in questions collection");
                    } catch (eSaveQ) {
                        db.newQuery("UPDATE _collections SET listRule = {:l}, viewRule = {:v}, createRule = {:c}, updateRule = {:u}, deleteRule = {:d} WHERE name = 'questions'")
                            .bind({ l: targetQList, v: targetQView, c: targetQCreate, u: targetQUpdate, d: targetQDelete }).execute();
                    }
                }

                // Ensure field select options in questions collection.
                // PENTING: .one() WAJIB menerima objek penampung (DynamicModel),
                // persis pola fast_restore.pb.js. Memanggil .one() tanpa argumen
                // memicu panic nil-pointer Go di dalam goja yang TIDAK bisa
                // ditangkap try/catch JS dan mematikan proses saat bootstrap
                // (insiden 2026-11-21: semua tenant down serentak).
                try {
                    const qRow = new DynamicModel({ fields: "" });
                    db.newQuery("SELECT fields FROM _collections WHERE name = 'questions'").one(qRow);
                    if (qRow.fields) {
                        const qFields = JSON.parse(qRow.fields);
                        let qfMod = false;
                        const allFieldTypes = [
                            "multiple_choice", "complex_choice", "true_false", "matching",
                            "short_answer", "essay", "sequence", "drag_drop",
                            "klasifikasi", "hotspot", "isian_rumpang", "matriks"
                        ];
                        for (let fi = 0; fi < qFields.length; fi++) {
                            if (qFields[fi].name === "field" && qFields[fi].type === "select") {
                                const curVals = qFields[fi].values || [];
                                for (let ti = 0; ti < allFieldTypes.length; ti++) {
                                    if (curVals.indexOf(allFieldTypes[ti]) === -1) {
                                        curVals.push(allFieldTypes[ti]);
                                        qfMod = true;
                                    }
                                }
                                qFields[fi].values = curVals;
                            }
                        }
                        if (qfMod) {
                            db.newQuery("UPDATE _collections SET fields = {:f} WHERE name = 'questions'")
                                .bind({ f: JSON.stringify(qFields) }).execute();
                            console.log("[SCHEMA_SYNC] Ensured all question field types in questions collection");
                        }
                    }
                } catch (eQFields) {}
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
