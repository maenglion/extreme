// ============================================================
// CASP Extreme v0 — API Layer (v2: single-file upload)
// ============================================================
import { API_BASE, isServerConfigured, API_KEY } from "../config.js";
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { log } from "../ui/dom.js";
import { generateMockResult, fakeSleep } from "../mock/mockResult.js";

export function getMeta(step) {
  const s = getCurrentSession();
  return {
    sid: s?.sid || "",
    nickname: STATE.nickname,
    dimension: STATE.dimension,
    target: STATE.target,
    protocol: STATE.protocol,
    step,
    pace_tag: s?.stepTags?.[step] || ""
  };
}

// v2에서는 chunk 업로드/stream notify를 안 씀 (남겨두되 no-op)
export function uploadChunk() {}
export function notifyStreamStart() {}
export function notifyStreamEnd() {}

/**
 * Step 분석 요청: Stop 시점에 생성된 audioBlob(단일 파일)을 업로드한다.
 * server 미설정/실패 시 mock.
 */
export async function requestStepAnalyze(step, sd) {
  if (isServerConfigured()) {
    try {
      if (!sd?.audioBlob) throw new Error("No audioBlob: stop first");

      const fd = new FormData();
      fd.append("file", sd.audioBlob, `S${step}.webm`);
      fd.append("meta", JSON.stringify(getMeta(step)));

      const r = await fetch(`${API_BASE}/engine/analyze`, {
        method: "POST",
        headers: {
          "X-API-Key": API_KEY,
        },
        body: fd,
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      log(`[api-fail] S${step}: ${e.message}, using mock`);
      return generateMockResult(step, sd);
    }
  } else {
    await fakeSleep(300);
    log(`[no-server] S${step} mock`);
    return generateMockResult(step, sd);
  }
}
