/**
 * Cloudflare Worker for Examku (R2 Storage, Upload, Delete & GET / Proxy with CORS)
 * Binds: env.EXAMKU_BUCKET
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── 1. GET: BACA GAMBAR / FILE DARI R2 ATAU PROXY DENGAN CORS ────────────
    if (request.method === "GET") {
      // Proxy untuk URL eksternal (misal: LaTeX CodeCogs)
      if (url.pathname === "/proxy") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: "url parameter is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const res = await fetch(targetUrl);
          const contentType = res.headers.get("Content-Type") || "application/octet-stream";
          return new Response(res.body, {
            status: res.status,
            headers: {
              ...corsHeaders,
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Baca file langsung dari R2 bucket berdasarkan key/path
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!key) {
        return new Response(JSON.stringify({ message: "Examku Worker is running" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const object = await env.EXAMKU_BUCKET.get(key);
        if (!object) {
          return new Response(JSON.stringify({ error: "File not found in R2", key }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new Response(object.body, { headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Hanya izinkan POST setelah titik ini
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };

    // ── 2. UPLOAD ────────────────────────────────────────────────────────────
    if (url.pathname === "/upload") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const key  = formData.get("key");

        if (!file || !key) {
          return new Response(JSON.stringify({ error: "file and key are required" }), { status: 400, headers });
        }

        const arrayBuffer = await file.arrayBuffer();
        await env.EXAMKU_BUCKET.put(key, arrayBuffer, {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });

        const publicBaseUrl = "https://assets.examku.my.id";
        const fileUrl = `${publicBaseUrl}/${key}`;

        return new Response(JSON.stringify({ success: true, key, url: fileUrl }), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
      }
    }

    // ── 3. DELETE ────────────────────────────────────────────────────────────
    try {
      const { key } = await request.json();
      if (!key) {
        return new Response(JSON.stringify({ error: "key is required" }), { status: 400, headers });
      }

      await env.EXAMKU_BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true, key }), { headers });

    } catch (err) {
      if (err.message?.includes("No such object") || err.message?.includes("404")) {
        return new Response(JSON.stringify({ success: true, message: "Already deleted" }), { headers });
      }
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers });
    }
  },
};
