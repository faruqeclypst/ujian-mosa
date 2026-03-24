const DB_URL = "https://ujian-mosa-default-rtdb.asia-southeast1.firebasedatabase.app";

export default async function handler(req: any, res: any) {
  const authHeader = req.headers['authorization'];
  
  // Ambil api_key dari URL query params (dukungan trigger luar)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiKey = url.searchParams.get("api_key");

  // 🛡️ Pastikan request berasal dari Vercel Cron ATAU Trigger Luar yang valid
  const isValidVercel = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isValidExternal = apiKey && process.env.CRON_SECRET && apiKey === process.env.CRON_SECRET;

  if (!isValidVercel && !isValidExternal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Generate token baru (6 karakter campuran huruf + angka)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 6; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 2. Tentukan URL (Gunakan parameter ?auth jika ada secret database)
    const secret = process.env.FIREBASE_DATABASE_SECRET;
    const url = secret ? `${DB_URL}/settings.json?auth=${secret}` : `${DB_URL}/settings.json`;

    // 3. Simpan ke Firebase Database menggunakan REST API
    const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            universal_token: token,
            universal_token_updated_at: Date.now()
        })
    });

    if (!response.ok) {
        throw new Error(`Firebase Error: ${response.status} ${response.statusText}`);
    }

    return res.status(200).json({ success: true, token });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
