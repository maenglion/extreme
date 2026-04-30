export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "method_not_allowed" }),
    };
  }

  const base = process.env.CASP_ENGINE_BASE;
  const apiKey = process.env.CASP_API_KEY;

  if (!base || !apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "missing_server_env",
        required: ["CASP_ENGINE_BASE", "CASP_API_KEY"],
      }),
    };
  }

  try {
    const res = await fetch(`${base}/engine/start`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
      },
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "proxy_failed",
        detail: String(err?.message || err),
      }),
    };
  }
}