// ============================================================
// CASP Extreme v0 — API Layer (Netlify Proxy Architecture)
// ──────────────────────────────────────────────────────────
// 프론트 → Netlify Functions(프록시) → 백엔드
// 인증(X-API-Key)은 Netlify 서버에서만 처리, 프론트에 키 없음
//
// /.netlify/functions/engine-start    세션 생성 (sessionStore에서 호출)
// /.netlify/functions/engine-ingest   오디오 업로드
// /.netlify/functions/engine-analyze  Step 분석
// /.netlify/functions/engine-report   Overall/Delta 조회
// ============================================================
import { isServerConfigured } from "../config.js";
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { log } from "../ui/dom.js";
import { generateMockResult, fakeSleep } from "../mock/mockResult.js";

// ── 공통 메타 ──
export function getMeta(step) {
  const s = getCurrentSession();
  return {
    sid: s?.engine_sid || "",
    nickname: STATE.nickname,
    dimension: STATE.dimension,
    target: STATE.target,
    protocol: STATE.protocol,
    step,
    pace_tag: s?.stepTags[step] || "",
  };
}

// ══════════════════════════════════════
//  1. INGEST — 오디오 업로드
// ══════════════════════════════════════
export async function ingestAudio(step, sd) {
  const s = getCurrentSession();
  if (!s?.engine_sid) {
    log(`[ingest] engine_sid missing — skip upload`);
    return null;
  }
  try {
    const meta = getMeta(step);
    const fd = new FormData();
    if (sd.audioBlob) {
      fd.append("file", sd.audioBlob, `step_${step}.webm`);
    }
    Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));

    const r = await fetch(`/.netlify/functions/engine-ingest`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    log(`[ingest] S${step} uploaded (${(sd.audioBlob?.size / 1024).toFixed(1)}KB)`);
    return j;
  } catch (e) {
    log(`[ingest-fail] S${step}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════
//  2. ANALYZE — Step 단위 엔진 실행
// ══════════════════════════════════════
export async function requestStepAnalyze(step, sd) {
  if (isServerConfigured()) {
    const s = getCurrentSession();
    if (!s?.engine_sid) {
      log(`[engine] engine_sid missing — check /engine/start. Using mock.`);
      return generateMockResult(step, sd);
    }

    // Step 1: Ingest (업로드)
    await ingestAudio(step, sd);

    // Step 2: Analyze (엔진 실행)
    try {
      const r = await fetch(`/.netlify/functions/engine-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getMeta(step)),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      log(`[analyze-fail] S${step}: ${e.message}, using mock`);
      return generateMockResult(step, sd);
    }
  } else {
    await fakeSleep(300);
    log(`[no-server] S${step} mock`);
    return generateMockResult(step, sd);
  }
}

// ══════════════════════════════════════
//  3. REPORT — 세션 Overall / Delta 조회
// ══════════════════════════════════════
export async function fetchReport() {
  const s = getCurrentSession();
  if (!isServerConfigured() || !s?.engine_sid) return null;
  try {
    const r = await fetch(`/.netlify/functions/engine-report?sid=${s.engine_sid}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    log(`[report-fail] ${e.message}`);
    return null;
  }
}