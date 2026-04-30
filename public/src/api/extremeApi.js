// ============================================================
// CASP Extreme v0 — API Layer (Netlify Proxy Architecture)
// ──────────────────────────────────────────────────────────
// 프론트 → Netlify Functions(BFF) → casp-engine-api
// 인증(X-API-Key)은 Netlify 서버에서만 처리, 프론트에 키 없음.
//
// 현재 사용:
//   /api/engine-start    세션 생성
//   /api/engine-analyze  오디오 + meta 분석
//   /api/engine-report   결과 조회
//
// 사용하지 않음:
//   engine-ingest
//   mockResult
// ============================================================

import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { log } from "../ui/dom.js";

// ── 공통 메타 ──
export function getMeta(step) {
  const s = getCurrentSession();

  return {
    sid: s?.engine_sid || "",              // CASP engine UUID
    client_sid: s?.id || s?.sid || "",     // ex_... 프론트 로컬 SID
    uid: "anon",
    stage_id: step,
    step,
    nickname: STATE.nickname || "",
    dimension: STATE.dimension || "",
    target: STATE.target || "",
    protocol: STATE.protocol || "",
    pace_tag: s?.stepTags?.[step] || "",
  };
}

function makeClientError(step, code, message, extra = {}) {
  return {
    ok: false,
    source: "client_error",
    error: code,
    detail: message,
    step,
    raw: null,
    calibrated: null,
    features_preview: null,
    debug_feature_source: null,
    debug_feature_error: message,
    ...extra,
  };
}

// ══════════════════════════════════════
//  ANALYZE — Step 단위 엔진 분석
// ══════════════════════════════════════
export async function requestStepAnalyze(step, sd) {
  const s = getCurrentSession();

  if (!s?.engine_sid) {
    const msg = "engine_sid missing — call /api/engine-start first";
    log(`[analyze-blocked] S${step}: ${msg}`);
    return makeClientError(step, "engine_sid_missing", msg);
  }

  if (!sd?.audioBlob) {
    const msg = "audioBlob missing";
    log(`[analyze-blocked] S${step}: ${msg}`);
    return makeClientError(step, "audio_blob_missing", msg);
  }

  try {
    const meta = getMeta(step);

    const fd = new FormData();
    fd.append("file", sd.audioBlob, `step_${step}.webm`);
    fd.append("meta", JSON.stringify(meta));

    const r = await fetch("/api/engine-analyze", {
      method: "POST",
      body: fd,
    });

    const j = await r.json();

    if (!r.ok) {
      throw new Error(j?.error || j?.detail || `HTTP ${r.status}`);
    }

    log(
      `[analyze] S${step} ${j.debug_feature_source || "server"} ` +
      `pause=${j.features_preview?.pause_ratio ?? "n/a"} ` +
      `snr=${j.features_preview?.snr_db_proxy ?? "n/a"}`
    );

    return j;
  } catch (e) {
    const msg = e?.message || String(e);
    log(`[analyze-fail] S${step}: ${msg}`);

    return makeClientError(step, "analyze_failed", msg);
  }
}

// ══════════════════════════════════════
//  REPORT — 세션 결과 조회
// ══════════════════════════════════════
export async function fetchReport() {
  const s = getCurrentSession();

  if (!s?.engine_sid) {
    log("[report-blocked] engine_sid missing");
    return null;
  }

  try {
    const r = await fetch(
      `/api/engine-report?sid=${encodeURIComponent(s.engine_sid)}`
    );

    const j = await r.json();

    if (!r.ok) {
      throw new Error(j?.error || j?.detail || `HTTP ${r.status}`);
    }

    return j;
  } catch (e) {
    log(`[report-fail] ${e?.message || String(e)}`);
    return null;
  }
}