// 🕒 Automated Universal Token Rotation (Runs every 5 minutes)
cronAdd("rotateUniversalToken", "*/5 * * * *", () => {
    const settings = $app.dao().findFirstRecordByFilter("settings", "1=1");
    if (!settings) return;
    const generate = () => {
        let t = "";
        for (let i = 0; i < 6; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
        return t;
    };

    if (!e.record.get("token")) {
        e.record.set("token", generate());
    }
}, "exam_rooms");
