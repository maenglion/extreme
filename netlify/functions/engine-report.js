const BFF_VERSION = "engine-report-v1";

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        bffVersion: BFF_VERSION,
        error: "method_not_allowed",
      }),
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
        bffVersion: BFF_VERSION,
        error: "missing_server_env",
        hasBase: Boolean(base),
        hasApiKey: Boolean(apiKey),
      }),
    };
  }

  const params = event.queryStringParameters || {};
  const sid = params.sid;

  if (!sid) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        bffVersion: BFF_VERSION,
        error: "sid_required",
      }),
    };
  }

  try {
    const res = await fetch(
      `${base}/engine/result/${encodeURIComponent(sid)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      }
    );

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
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        bffVersion: BFF_VERSION,
        error: "proxy_failed",
        detail: String(err && err.message ? err.message : err),
      }),
    };
  }
};