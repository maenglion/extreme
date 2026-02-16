// Netlify Function — POST /.netlify/functions/engine-ingest
// FormData(file + meta)를 백엔드로 그대로 전달
export default async (req) => {
  const API_BASE    = process.env.API_BASE;
  const API_KEY_HASH = process.env.API_KEY_HASH;

  if (!API_BASE) {
    return new Response(JSON.stringify({ error: "API_BASE not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // FormData를 그대로 바이너리 패스스루
    const body = await req.arrayBuffer();
    const contentType = req.headers.get("content-type") || "";

    const r = await fetch(`${API_BASE}/engine/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(API_KEY_HASH ? { "x-api-key": API_KEY_HASH } : {}),
      },
      body,
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};