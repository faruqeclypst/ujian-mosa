/// <reference path="../pb_data/types.d.ts" />
// Set busy_timeout + pragma tambahan agar SQLite menunggu lock alih-alih langsung gagal.
onBootstrap((e) => {
    e.next()
    try {
        const db = $app.db()
        db.newQuery("PRAGMA busy_timeout = 5000").execute()
        db.newQuery("PRAGMA journal_size_limit = 200000000").execute()
        console.log("[pragma] busy_timeout=5000, journal_size_limit=200MB applied")
    } catch (err) {
        console.error("[pragma] failed:", err)
    }
})
