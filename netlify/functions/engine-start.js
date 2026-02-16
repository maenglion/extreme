// netlify/functions/engine-start.js
exports.handler = async function (event) {
  try {
    const API_BASE = process.env.API_BASE;
    const API_KEY_HASH = process.env.API_KEY_HASH;

    if (!API_BASE || !API_KEY_HASH) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API_BASE or API_KEY_HASH" }),
      };
    }

    const res = await fetch(`${API_BASE}/engine/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY_HASH,
      },
      body: event.body || "{}",
    });

    const body = await res.text();
    return {
      statusCode: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
      body,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e && e.message ? e.message : e) }),
    };
  }
};
