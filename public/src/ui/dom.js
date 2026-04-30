// ============================================================
// CASP Extreme v0 — DOM Cache & Logging
// ============================================================

export const DOM = {};

export function initDOM() {
  DOM.nickname         = document.getElementById("nickname");
  DOM.dimension        = document.getElementById("dimension");
  DOM.target           = document.getElementById("target");
  DOM.targetValue      = document.getElementById("target-value");
  DOM.sidDisplay       = document.getElementById("sid-display");
  DOM.serverStatus     = document.getElementById("server-status");
  DOM.viewBadge        = document.getElementById("view-badge");
  DOM.stepTabs         = document.getElementById("step-tabs");
  DOM.stepLabel        = document.getElementById("step-label");
  DOM.btnRecord        = document.getElementById("btn-record");
  DOM.btnPause         = document.getElementById("btn-pause");
  DOM.btnStop          = document.getElementById("btn-stop");
  DOM.btnAnalyze       = document.getElementById("btn-analyze");
  DOM.btnNewSession    = document.getElementById("btn-new-session");
  DOM.btnBackToActive  = document.getElementById("btn-back-to-active");
  DOM.recordStatus     = document.getElementById("record-status");
  DOM.stepResultArea   = document.getElementById("step-result-area");
  DOM.overallResultArea= document.getElementById("overall-result-area");
  DOM.deltaArea        = document.getElementById("delta-area");
  DOM.streamInfo       = document.getElementById("stream-info");
  DOM.sessionList      = document.getElementById("session-list");
  DOM.logArea          = document.getElementById("log-area");

  // BFF 모드: 초기 상태는 대기. engine-start 성공 시 updateServerStatus로 갱신.
  DOM.serverStatus.textContent = "⏳ Engine standby";
  DOM.serverStatus.className = "server-status standby";
}

// engine-start 성공/실패 시 호출
export function updateServerStatus(connected, detail) {
  if (connected) {
    DOM.serverStatus.textContent = "● Engine connected";
    DOM.serverStatus.className = "server-status configured";
  } else {
    DOM.serverStatus.textContent = `⚠ Engine error: ${detail || "unknown"}`;
    DOM.serverStatus.className = "server-status not-configured";
  }
}

export function log(msg) {
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${msg}`;
  console.log(line);
  if (DOM.logArea) {
    DOM.logArea.textContent += line + "\n";
    DOM.logArea.scrollTop = DOM.logArea.scrollHeight;
  }
}