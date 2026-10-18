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
                const targetViewRule = 'id = @request.auth.id || @request.auth.role = "admin"';
                if (usersCol.viewRule !== targetViewRule) {
                    usersCol.viewRule = targetViewRule;
                    $app.save(usersCol);
                    console.log("[USER_SYNC] Ensured viewRule on users collection: " + targetViewRule);
                }
            }
        } catch (errUser) {
            // Notice only
        }
    } catch (e) {
        console.warn("[STUDENT_SYNC] Bootstrap notice:", e);
    }
});
