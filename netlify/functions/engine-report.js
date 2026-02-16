// Netlify Function — GET /.netlify/functions/engine-report?sid=xxx
export default async (req) => {
  const API_BASE    = process.env.API_BASE;
  const API_KEY_HASH = process.env.API_KEY_HASH;

  const url = new URL(req.url);
  const sid = url.searchParams.get("sid");
  if (!sid) {
    return new Response(JSON.stringify({ error: "sid required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!API_BASE) {
    return new Response(JSON.stringify({ error: "API_BASE not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const r = await fetch(`${API_BASE}/engine/report/${sid}`, {
      headers: {
        ...(API_KEY_HASH ? { "x-api-key": API_KEY_HASH } : {}),
      },
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