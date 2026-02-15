// ============================================================
// CASP Extreme v0 — Session Store
// ============================================================
import { STEP_COUNT } from "../config.js";

export function generateSID() { return "ex_"+Date.now()+"_"+Math.random().toString(36).slice(2,8); }
export function now() { return new Date().toISOString(); }

function createStepState() {
  return { isRecording:false, isPaused:false, isDone:false, chunksCount:0, voiceActiveMs:0, result:null };
}
function createSteps() { const s={}; for(let i=1;i<=STEP_COUNT;i++) s[i]=createStepState(); return s; }
function createSession(sid) { return { sid, createdAt:now(), updatedAt:now(), steps:createSteps(), overall:null, stepTags:{} }; }

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

export function startNewSession(refreshAllFn) {
  if(!STATE.nickname) return false;
  const p=getProfile(STATE.nickname);
  const sid=generateSID();
  p.sessions.push(createSession(sid));
  p.activeSessionId=sid;
  STATE.viewMode=false; STATE.viewingSid=null;
  if(refreshAllFn) refreshAllFn();
  return sid;
}

export function switchToSession(sid, refreshAllFn) {
  const p=getProfile(STATE.nickname);
  if(sid===p.activeSessionId){STATE.viewMode=false;STATE.viewingSid=null;}
  else{STATE.viewMode=true;STATE.viewingSid=sid;}
  if(refreshAllFn) refreshAllFn();
}