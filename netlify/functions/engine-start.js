// Netlify Function — POST /.netlify/functions/engine-start
// 프론트는 키 없이 여기로 → 서버 키는 Netlify 환경변수에만 존재
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
    const r = await fetch(`${API_BASE}/engine/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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