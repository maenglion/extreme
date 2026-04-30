// ============================================================
// CASP Extreme v0 — Render
// ============================================================
import { STEP_COUNT, STEP_LABELS, PREVIEW_METRICS, SCORE_KEYS, DELTA_METRICS } from "../config.js";
import { STATE, getCurrentSession, switchToSession, getProfile } from "../state/sessionStore.js";
import { DOM } from "./dom.js";
import { selectStep, updateButtons } from "./actions.js";

export function refreshAll() {
  const s = getCurrentSession();
  STATE.currentStep = 1;
  renderSessionList();
  renderViewBadge();
  renderStepTabs(s);
  selectStep(1);
  renderAllStepResults(s);
  renderOverall(s);
  renderDelta(s);
  updateButtons();
  DOM.sidDisplay.textContent = s ? s.sid : "—";
}

export function renderViewBadge() {
  if (STATE.viewMode) {
    DOM.viewBadge.textContent = "📖 읽기 전용";
    DOM.viewBadge.style.display = "inline-block";
    DOM.btnBackToActive.style.display = "inline-block";
  } else {
    DOM.viewBadge.style.display = "none";
    DOM.btnBackToActive.style.display = "none";
  }
}

export function renderSessionList() {
  if (!STATE.nickname) {
    DOM.sessionList.innerHTML = '<p class="placeholder">닉네임 입력 후 표시</p>';
    return;
  }
  const p = getProfile(STATE.nickname);
  if (p.sessions.length === 0) {
    DOM.sessionList.innerHTML = '<p class="placeholder">세션 없음</p>';
    return;
  }
  const viewSid = STATE.viewMode ? STATE.viewingSid : p.activeSessionId;
  DOM.sessionList.innerHTML = p.sessions
    .slice()
    .reverse()
    .map((s) => {
      const isAct = s.sid === p.activeSessionId;
      const isView = s.sid === viewSid;
      const done = Object.values(s.steps).filter((st) => st.isDone).length;
      const pct = Math.round((done / STEP_COUNT) * 100);
      const time = new Date(s.createdAt).toLocaleTimeString();
      return `<div class="session-item ${isAct ? "active-session" : "past-session"} ${isView ? "viewing" : ""}" data-sid="${s.sid}">
      <div class="session-item-top"><span class="session-sid">${s.sid.slice(-10)}</span>${isAct ? '<span class="session-active-badge">LIVE</span>' : ""}</div>
      <div class="session-item-bottom"><span>${time}</span><span>S${done}/${STEP_COUNT}</span></div>
      <div class="session-progress"><div class="session-progress-bar" style="width:${pct}%"></div></div></div>`;
    })
    .join("");
  DOM.sessionList.querySelectorAll(".session-item").forEach((el) => {
    el.addEventListener("click", () =>
      switchToSession(el.dataset.sid, refreshAll)
    );
  });
}

export function renderStepTabs(session) {
  DOM.stepTabs.innerHTML = "";
  for (let i = 1; i <= STEP_COUNT; i++) {
    const t = document.createElement("div");
    t.className = "step-tab";
    t.dataset.step = i;
    t.textContent = `S${i}`;
    if (session && session.steps[i].isDone) t.classList.add("recorded");
    if (i === STATE.currentStep) t.classList.add("active");
    t.addEventListener("click", () => selectStep(i));
    DOM.stepTabs.appendChild(t);
  }
}

export function renderAllStepResults(session) {
  DOM.stepResultArea.innerHTML = "";
  if (!session) return;
  for (let s = 1; s <= STEP_COUNT; s++) {
    if (session.steps[s].result) renderStepResult(s, session.steps[s].result);
  }
}

// ── Step Result 렌더링 (서버 응답 기준) ──
export function renderStepResult(step, data) {
  let c = document.getElementById(`step-result-${step}`);
  if (!c) {
    c = document.createElement("div");
    c.id = `step-result-${step}`;
    c.className = "result-card";
    DOM.stepResultArea.appendChild(c);
  }

  const fp = data.features_preview || {};
  const raw = data.raw || {};
  const source = data.debug_feature_source || "unknown";
  const error = data.debug_feature_error || null;

  // 상단: source + duration/sample_rate
  let headerExtra = `<span class="result-source">${source}</span>`;
  if (fp.duration_ms != null) {
    headerExtra += ` <span class="result-duration">${(fp.duration_ms / 1000).toFixed(1)}s</span>`;
  }
  if (fp.sample_rate != null) {
    headerExtra += ` <span class="result-sr">${fp.sample_rate}Hz</span>`;
  }

  // features_preview 지표
  const previewHtml = PREVIEW_METRICS.map(
    (m) =>
      `<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m, fp[m])}</span></div>`
  ).join("");

  // scores
  const scoreHtml = SCORE_KEYS.map((k) => {
    const v = raw[k];
    return `<div class="metric-item"><span class="metric-name">${k}</span><span class="metric-value">${v != null ? v : "—"}</span></div>`;
  }).join("");

  // ready / reason
  let readyHtml = "";
  if (raw.ready != null) {
    const isReady = raw.ready === 1 || raw.ready === true;
const readyText = isReady ? "✅ ready" : "⚠ not ready";
    const reasonText = raw.reason ? ` (${raw.reason})` : "";
    readyHtml = `<div class="metric-item metric-ready"><span class="metric-name">VSI gate</span><span class="metric-value">${readyText}${reasonText}</span></div>`;
  }

  // error
  let errorHtml = "";
  if (error) {
    errorHtml = `<div class="metric-item metric-error"><span class="metric-name">error</span><span class="metric-value">${error}</span></div>`;
  }

  c.innerHTML = `
    <div class="result-card-header">
      <span class="result-step-badge">S${step}</span>
      <span class="result-step-label">${STEP_LABELS[step] || ""}</span>
      ${headerExtra}
    </div>
    <div class="result-metrics">
      ${previewHtml}
    </div>
    <div class="result-scores">
      ${scoreHtml}
      ${readyHtml}
    </div>
    ${errorHtml}
  `;
  c.classList.add("visible");
}

export function highlightStepResult(step) {
  document.querySelectorAll(".result-card").forEach((el) => {
    el.classList.toggle("highlighted", el.id === `step-result-${step}`);
  });
}

export function renderOverall(session) {
  if (!session?.overall) {
    DOM.overallResultArea.innerHTML =
      '<p class="placeholder">Analyze로 Overall 계산</p>';
    return;
  }
  const o = session.overall;

  // Overall도 서버 응답 구조일 수 있고, 프론트 계산일 수도 있음
  const fp = o.features_preview || o;
  const raw = o.raw || o;

  const previewHtml = PREVIEW_METRICS.map(
    (m) =>
      `<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m, fp[m])}</span></div>`
  ).join("");

  const scoreHtml = SCORE_KEYS.map((k) => {
    const v = raw[k];
    return `<div class="metric-item"><span class="metric-name">${k}</span><span class="metric-value">${v != null ? v : "—"}</span></div>`;
  }).join("");

  DOM.overallResultArea.innerHTML = `<div class="result-card overall-card visible">
    <div class="result-card-header">
      <span class="result-step-badge overall-badge">Overall</span>
      <span class="result-step-label">${o._steps ? `${o._steps} steps` : ""}</span>
    </div>
    <div class="result-metrics">${previewHtml}</div>
    <div class="result-scores">${scoreHtml}</div>
  </div>`;
}

export function renderDelta(session) {
  if (!session) {
    DOM.deltaArea.innerHTML = "";
    return;
  }
  const base = session.steps[1].result;
  if (!base) {
    DOM.deltaArea.innerHTML =
      '<p class="placeholder">S1 완료 후 Delta 표시</p>';
    return;
  }

  const baseFp = base.features_preview || base;

  let rows = "";
  for (let s = 2; s <= STEP_COUNT; s++) {
    const d = session.steps[s].result;
    if (!d) continue;
    const dFp = d.features_preview || d;
    const cells = DELTA_METRICS.map((m) => {
      const bv = baseFp[m];
      const dv = dFp[m];
      if (bv == null || dv == null) return `<td>—</td>`;
      const v = dv - bv;
      return `<td class="${v > 0 ? "delta-pos" : v < 0 ? "delta-neg" : ""}">${v >= 0 ? "+" : ""}${formatMetric(m, v)}</td>`;
    }).join("");
    rows += `<tr><td class="delta-step-label">S${s}</td>${cells}</tr>`;
  }
  if (!rows) {
    DOM.deltaArea.innerHTML =
      '<p class="placeholder">S2+ 완료 후 Delta 표시</p>';
    return;
  }
  DOM.deltaArea.innerHTML = `<table class="delta-table"><thead><tr><th></th>${DELTA_METRICS.map(
    (m) => `<th>Δ${m}</th>`
  ).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function formatMetric(name, value) {
  if (value == null) return "—";
  if (name.includes("ratio")) return (value * 100).toFixed(1) + "%";
  if (name.includes("ms")) return Math.round(value) + "ms";
  if (name.includes("rms")) return value.toFixed(4);
  return typeof value === "number" ? value.toFixed(2) : value;
}