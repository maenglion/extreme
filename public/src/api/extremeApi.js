// ============================================================
// CASP Extreme v0 — API Layer
// ============================================================
import { API_BASE, isServerConfigured } from "../config.js";
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { log } from "../ui/dom.js";
import { generateMockResult, fakeSleep } from "../mock/mockResult.js";

export function getMeta(step) {
  const s=getCurrentSession();
  return {sid:s?.sid||"",nickname:STATE.nickname,dimension:STATE.dimension,target:STATE.target,protocol:STATE.protocol,step,pace_tag:s?.stepTags[step]||""};
}

export function uploadChunk(blob,step,idx) {
  if(!isServerConfigured()){console.log(`[no-server] chunk ${idx} S${step}`);return;}
  const fd=new FormData();fd.append("audio",blob,`chunk_${idx}.webm`);fd.append("sid",getCurrentSession()?.sid||"");fd.append("step",step);fd.append("chunk_index",idx);
  fetch(`${API_BASE}/extreme/stream/chunk`,{method:"POST",body:fd}).catch(()=>{});
}

export function notifyStreamStart(step) {
  if(!isServerConfigured()){log(`[no-server] stream/start S${step}`);return;}
  fetch(`${API_BASE}/extreme/stream/start`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))}).catch(()=>{});
}

export function notifyStreamEnd(step) {
  if(!isServerConfigured()){log(`[no-server] stream/end S${step}`);return;}
  fetch(`${API_BASE}/extreme/stream/end`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))}).catch(()=>{});
}

/**
 * Step 분석 요청. 서버 미설정이거나 실패 시 mock 반환.
 */
export async function requestStepAnalyze(step, sd) {
  if(isServerConfigured()){
    try{
      const r=await fetch(`${API_BASE}/extreme/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))});
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