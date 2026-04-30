// ============================================================
// CASP Extreme v0 — Session Store
// ============================================================
import { STEP_COUNT } from "../config.js";

export function generateSID() {
  return "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}
export function now() {
  return new Date().toISOString();
}

function createStepState() {
  return {
    isRecording: false,
    isPaused: false,
    isDone: false,
    chunksCount: 0,
    voiceActiveMs: 0,
    result: null,
  };
}
function createSteps() {
  const s = {};
  for (let i = 1; i <= STEP_COUNT; i++) s[i] = createStepState();
  return s;
}
function createSession(sid) {
  return {
    sid,
    engine_sid: null,
    engine_identity: null,
    engine_started_at: null,
    engine_start_error: null,
    createdAt: now(),
    updatedAt: now(),
    steps: createSteps(),
    overall: null,
    stepTags: {},
  };
}

// ── Profiles ──
const profiles = {};
export function getProfile(n) {
  if (!profiles[n]) profiles[n] = { activeSessionId: null, sessions: [] };
  return profiles[n];
}
export function getActiveSession(n) {
  const p = getProfile(n);
  return p.sessions.find((s) => s.sid === p.activeSessionId) || null;
}
export function findSession(n, sid) {
  return getProfile(n).sessions.find((s) => s.sid === sid) || null;
}

// ── Runtime State ──
export const STATE = {
  nickname: "",
  dimension: "baseline",
  target: 50,
  protocol: "extreme_v0",
  currentStep: 1,
  viewMode: false,
  viewingSid: null,
  displayStream: null,
  audioTrack: null,
  mediaRecorder: null,
};

// ── Session helpers ──
export function getCurrentSession() {
  if (!STATE.nickname) return null;
  if (STATE.viewMode && STATE.viewingSid)
    return findSession(STATE.nickname, STATE.viewingSid);
  return getActiveSession(STATE.nickname);
}

export async function startNewSession(refreshAllFn) {
  if (!STATE.nickname) return false;

  const p = getProfile(STATE.nickname);
  const sid = generateSID();
  const session = createSession(sid);

  // BFF 기준: 항상 /api/engine-start 호출.
  // 실패해도 client_sid는 유지, analyze에서 engine_sid_missing으로 드러남.
  try {
    const r = await fetch("/api/engine-start", {
      method: "POST",
    });

    const j = await r.json();

    if (!r.ok || !j?.sid) {
      throw new Error(j?.error || j?.detail || `HTTP ${r.status}`);
    }

    session.engine_sid = j.sid;
    session.engine_identity = j.identity || null;
    session.engine_started_at = now();
    session.engine_start_error = null;
  } catch (e) {
    session.engine_sid = null;
    session.engine_identity = null;
    session.engine_started_at = null;
    session.engine_start_error = e?.message || String(e);
  }

  session.updatedAt = now();

  p.sessions.push(session);
  p.activeSessionId = sid;

  STATE.viewMode = false;
  STATE.viewingSid = null;

  if (refreshAllFn) refreshAllFn();

  return sid;
}

export function switchToSession(sid, refreshAllFn) {
  const p = getProfile(STATE.nickname);
  if (sid === p.activeSessionId) {
    STATE.viewMode = false;
    STATE.viewingSid = null;
  } else {
    STATE.viewMode = true;
    STATE.viewingSid = sid;
  }
  if (refreshAllFn) refreshAllFn();
}