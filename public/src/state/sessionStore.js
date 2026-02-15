// ============================================================
// CASP Extreme v0 — Session Store
// ============================================================
import { STEP_COUNT, API_BASE, API_KEY, isServerConfigured } from "../config.js";

export function generateSID() { return "ex_"+Date.now()+"_"+Math.random().toString(36).slice(2,8); }
export function now() { return new Date().toISOString(); }

function createStepState() {
  return { isRecording:false, isPaused:false, isDone:false, chunksCount:0, voiceActiveMs:0, result:null };
}
function createSteps() { const s={}; for(let i=1;i<=STEP_COUNT;i++) s[i]=createStepState(); return s; }
function createSession(sid) { return { sid, engine_sid:null, createdAt:now(), updatedAt:now(), steps:createSteps(), overall:null, stepTags:{} }; }

// ── Profiles ──
const profiles = {};
export function getProfile(n) { if(!profiles[n]) profiles[n]={activeSessionId:null,sessions:[]}; return profiles[n]; }
export function getActiveSession(n) { const p=getProfile(n); return p.sessions.find(s=>s.sid===p.activeSessionId)||null; }
export function findSession(n,sid) { return getProfile(n).sessions.find(s=>s.sid===sid)||null; }

// ── Runtime State ──
export const STATE = {
  nickname:"", dimension:"baseline", target:50, protocol:"extreme_v0",
  currentStep:1, viewMode:false, viewingSid:null,
  displayStream:null, audioTrack:null, mediaRecorder:null,
};

// ── Session helpers ──
export function getCurrentSession() {
  if(!STATE.nickname) return null;
  if(STATE.viewMode&&STATE.viewingSid) return findSession(STATE.nickname,STATE.viewingSid);
  return getActiveSession(STATE.nickname);
}

export async function startNewSession() {
  // 1) 로컬 세션은 무조건 생성 (여기서 s1~s10 steps가 세팅돼야 함)
  const session = createSession(/* 기존 로직 그대로 */);
  STATE.profiles[STATE.nickname].sessions.unshift(session);
  STATE.activeSessionId = session.sid;   // 로컬 sid

  // 2) 서버가 있으면 engine_sid만 추가
  try {
    if (isServerConfigured() && API_KEY) {
      const r = await fetch(`${API_BASE}/engine/start`, {
        method: "POST",
        headers: { "X-API-Key": API_KEY },
      });
      if (r.ok) {
        const j = await r.json();
        session.engine_sid = j.sid;
      }
    }
  } catch (e) {
    // 실패해도 무시: 로컬 세션은 이미 살아있음
  }

  return session;
}

export function switchToSession(sid, refreshAllFn) {
  const p=getProfile(STATE.nickname);
  if(sid===p.activeSessionId){STATE.viewMode=false;STATE.viewingSid=null;}
  else{STATE.viewMode=true;STATE.viewingSid=sid;}
  if(refreshAllFn) refreshAllFn();
}