// ============================================================
// CASP Extreme v0 — DOM Cache & Logging
// ============================================================
import { API_BASE, isServerConfigured } from "../config.js";

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

  if(isServerConfigured()){
    DOM.serverStatus.textContent=`API: ${API_BASE}`;
    DOM.serverStatus.className="server-status configured";
  } else {
    DOM.serverStatus.textContent="⚠ Server not configured";
    DOM.serverStatus.className="server-status not-configured";
  }
}

export function log(msg) {
  const t=new Date().toLocaleTimeString();
  const line=`[${t}] ${msg}`;
  console.log(line);
  if(DOM.logArea){DOM.logArea.textContent+=line+"\n";DOM.logArea.scrollTop=DOM.logArea.scrollHeight;}
}