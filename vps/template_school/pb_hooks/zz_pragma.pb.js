/// <reference path="../pb_data/types.d.ts" />
// Set busy_timeout + pragma tambahan agar SQLite menunggu lock alih-alih langsung gagal.
onBootstrap((e) => {
    e.next()
    try {
        const db = $app.db()
        db.newQuery("PRAGMA busy_timeout = 10000").execute()
        db.newQuery("PRAGMA journal_size_limit = 200000000").execute()
        db.newQuery("PRAGMA synchronous = NORMAL").execute()
        console.log("[pragma] busy_timeout=10000, journal_size_limit=200MB, synchronous=NORMAL applied")
    } catch (err) {
        console.error("[pragma] failed:", err)
    }
})
