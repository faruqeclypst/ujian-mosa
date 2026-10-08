// pb_hooks/user_avatar_sync.pb.js
// Auto-ensure avatar_url field on users collection (foto profil guru & admin).
// URL foto disimpan sebagai teks (upload ke R2/external storage), bukan file PocketBase.
onBootstrap((e) => {
    e.next();
    try {
        const collection = $app.findCollectionByNameOrId("users");
        if (!collection) return;
        if (!collection.fields.getByName("avatar_url")) {
            const tf = new TextField();
            tf.name = "avatar_url";
            tf.required = false;
            collection.fields.add(tf);
            $app.save(collection);
            console.log("[USER_AVATAR_SYNC] Added avatar_url field to users collection");
        }
        // Pastikan tabel punya kolomnya (jaga-jaga)
        try {
            $app.db().newQuery('ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT "" NOT NULL').execute();
        } catch (x) {
            // Kolom sudah ada
        }
    } catch (err) {
        console.warn("[USER_AVATAR_SYNC] Bootstrap notice:", err);
    }
});
