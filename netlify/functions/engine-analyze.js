// Netlify Function — POST /.netlify/functions/engine-analyze
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
    const body = await req.text();

    const r = await fetch(`${API_BASE}/engine/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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