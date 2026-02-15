// ============================================================
// CASP Extreme v0 — API Layer
// ============================================================
import { API_BASE, API_KEY, isServerConfigured } from "../config.js";
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { log } from "../ui/dom.js";
import { generateMockResult, fakeSleep } from "../mock/mockResult.js";

export function getMeta(step) {
  const s=getCurrentSession();
  return {sid:s?.engine_sid||"",nickname:STATE.nickname,dimension:STATE.dimension,target:STATE.target,protocol:STATE.protocol,step,pace_tag:s?.stepTags[step]||""};
}

/**
 * Step 분석 요청.
 * Stop 시점에 만들어진 sd.audioBlob을 FormData로 POST {API_BASE}/engine/analyze
 * 서버 미설정이거나 실패 시 mock 반환.
 */
export async function requestStepAnalyze(step, sd) {
  if(isServerConfigured()){
    const s=getCurrentSession();
    if(!s?.engine_sid){
      log(`[engine] engine_sid missing — check API key or /engine/start failed. Using mock.`);
      return generateMockResult(step,sd);
    }
    try{
      const meta=getMeta(step);
      const fd=new FormData();

      // 오디오 파일
      if(sd.audioBlob){
        fd.append("file", sd.audioBlob, `step_${step}.webm`);
      }

      // 메타데이터 필드
      Object.entries(meta).forEach(([k,v])=>fd.append(k,String(v)));

      const headers = {};
      if(API_KEY) headers["X-API-Key"] = API_KEY;

      const r=await fetch(`${API_BASE}/engine/analyze`,{
        method:"POST",
        headers,
        body:fd,
      });
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(e){
      log(`[api-fail] S${step}: ${e.message}, using mock`);
      return generateMockResult(step,sd);
    }
  }else{
    await fakeSleep(300);
    log(`[no-server] S${step} mock`);
    return generateMockResult(step,sd);
  }
}