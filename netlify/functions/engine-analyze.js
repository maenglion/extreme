exports.handler = async function (event) {
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
        hasBase: Boolean(base),
        hasApiKey: Boolean(apiKey),
      }),
    };
  }

  const contentType =
    event.headers["content-type"] ||
    event.headers["Content-Type"];

  if (!contentType || !contentType.includes("multipart/form-data")) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "expected_multipart_form_data",
        contentType: contentType || null,
      }),
    };
  }

  try {
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf8");

    const res = await fetch(`${base}/engine/analyze`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": contentType,
      },
      body: bodyBuffer,
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
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "proxy_failed",
        detail: String(err && err.message ? err.message : err),
      }),
    };
  }
};