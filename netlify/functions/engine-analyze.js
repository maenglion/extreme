const multipart = require("lambda-multipart-parser");

const BFF_VERSION = "engine-analyze-parse-rebuild-v1";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
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

  try {
    const parsed = await multipart.parse(event);

    const file = parsed.files && parsed.files[0];
    const meta = parsed.meta;

    if (!file) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          bffVersion: BFF_VERSION,
          error: "missing_file",
        }),
      };
    }

    if (!meta) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          bffVersion: BFF_VERSION,
          error: "missing_meta",
        }),
      };
    }

    // BFF에서 먼저 JSON 검증
    try {
      JSON.parse(meta);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          bffVersion: BFF_VERSION,
          error: "invalid_meta_json_at_bff",
          metaPreview: String(meta).slice(0, 300),
        }),
      };
    }

    // CASP Engine으로 보낼 새 FormData 구성
    const fd = new FormData();

    fd.append("meta", meta);

    const blob = new Blob([file.content], {
      type: file.contentType || "application/octet-stream",
    });

    fd.append("file", blob, file.filename || "recording.webm");

    const res = await fetch(`${base}/engine/analyze`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        // Content-Type 직접 지정 금지.
        // FormData가 boundary 포함해서 자동 생성해야 함.
      },
      body: fd,
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
        bffVersion: BFF_VERSION,
        error: "proxy_failed",
        detail: String(err && err.message ? err.message : err),
      }),
    };
  }
};