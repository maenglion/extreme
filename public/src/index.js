// ============================================================
// CASP Extreme v0 — Entry Point (ES Module)
// ============================================================
import { STEP_COUNT, SCORE_KEYS } from "./config.js";
import { STATE, getCurrentSession, getProfile, startNewSession, switchToSession, now } from "./state/sessionStore.js";
import { DOM, initDOM, log, updateServerStatus } from "./ui/dom.js";
import { refreshAll, renderStepTabs, renderOverall, renderDelta } from "./ui/render.js";
import { selectStep, updateButtons } from "./ui/actions.js";
import { updateStreamInfo, _injectStopRecording } from "./audio/tabAudio.js";
import { startRecording, pauseRecording, stopRecording, initCtrlChannel } from "./audio/recorder.js";
import { fetchReport } from "./api/extremeApi.js";

// Wire circular dependency
_injectStopRecording(stopRecording);

// ── Analyze Session (Overall) ──
async function analyzeSession() {
  const session = getCurrentSession();
  if (!session) return;

  if (!session.engine_sid) {
    log("[engine] engine_sid missing — Overall 분석 불가.");
    return;
  }

  const done = [];
  for (let s = 1; s <= STEP_COUNT; s++) {
    if (session.steps[s].isDone && session.steps[s].result) done.push(s);
  }
  if (done.length === 0) {
    alert("완료된 Step 없음");
    return;
  }

  DOM.btnAnalyze.disabled = true;
  DOM.btnAnalyze.querySelector(".btn-text").textContent = "⏳ 분석 중...";

  // 서버 report 시도
  if (session.engine_sid) {
    const report = await fetchReport();
    if (report && report.overall) {
      session.overall = report.overall;
      session.updatedAt = now();
      renderOverall(session);
      renderDelta(session);
      log(`Overall 완료 (서버 report)`);
      DOM.btnAnalyze.querySelector(".btn-text").textContent = "📊 Analyze (Overall)";
      DOM.btnAnalyze.disabled = false;
      return;
    }
    log("[report] 서버 report 없음 — 현재 Step 결과로 Overall 계산");
  }

  // Fallback: 프론트 가중평균 (features_preview 기반)
  let totalDur = 0;
  done.forEach((s) => {
    const fp = session.steps[s].result?.features_preview || {};
    totalDur += (fp.duration_ms || 1000) / 1000;
  });

  const overall = {};
  const previewKeys = ["pause_ratio", "silence_ratio", "energy_decay", "speech_rate_proxy", "snr_db_proxy", "clipping_ratio"];
  previewKeys.forEach((m) => {
    let ws = 0;
    done.forEach((s) => {
      const fp = session.steps[s].result?.features_preview || {};
      const dur = (fp.duration_ms || 1000) / 1000;
      ws += (fp[m] || 0) * (dur / totalDur);
    });
    overall[m] = ws;
  });

  // 스코어 평균
  SCORE_KEYS.forEach((k) => {
    let sum = 0, cnt = 0;
    done.forEach((s) => {
      const raw = session.steps[s].result?.raw || {};
      if (raw[k] != null) { sum += raw[k]; cnt++; }
    });
    overall[k] = cnt > 0 ? Math.round(sum / cnt) : null;
  });

  overall._steps = done.length;
  overall._totalDuration = totalDur;
  overall.features_preview = overall;
  overall.raw = overall;

  session.overall = overall;
  session.updatedAt = now();

  renderOverall(session);
  renderDelta(session);
  log(`Overall 완료 (${done.length} steps, step 결과 집계)`);
  DOM.btnAnalyze.querySelector(".btn-text").textContent = "📊 Analyze (Overall)";
  DOM.btnAnalyze.disabled = false;
}

// ── Event Binding ──
function bindEvents() {
  DOM.nickname.addEventListener("change", async (e) => {
    const n = e.target.value.trim();
    if (!n) return;
    STATE.nickname = n;
    STATE.viewMode = false;
    STATE.viewingSid = null;

    const p = getProfile(n);
    if (!p.activeSessionId) {
      const sid = await startNewSession(refreshAll);
      if (sid) {
        initCtrlChannel(sid);
        const s = getCurrentSession();
        if (s?.engine_sid) {
          updateServerStatus(true);
          log(`새 세션: ${sid} | engine: ${s.engine_sid}`);
        } else {
          updateServerStatus(false, s?.engine_start_error || "engine_sid missing");
          log(`새 세션: ${sid} | engine 연결 실패: ${s?.engine_start_error || "unknown"}`);
        }
      }
    } else {
      const s = getCurrentSession();
      if (s) initCtrlChannel(s.sid);
      refreshAll();
    }
    log(`닉네임: ${n}`);
  });

  DOM.dimension.addEventListener("change", (e) => {
    STATE.dimension = e.target.value;
  });
  DOM.target.addEventListener("input", (e) => {
    STATE.target = parseInt(e.target.value);
    DOM.targetValue.textContent = STATE.target;
  });

  DOM.btnRecord.addEventListener("click", startRecording);
  DOM.btnPause.addEventListener("click", pauseRecording);
  DOM.btnStop.addEventListener("click", stopRecording);
  DOM.btnAnalyze.addEventListener("click", analyzeSession);

  DOM.btnNewSession.addEventListener("click", async () => {
    if (!STATE.nickname) {
      alert("Nickname 먼저 입력");
      DOM.nickname.focus();
      return;
    }
    const sid = await startNewSession(refreshAll);
    if (sid) {
      initCtrlChannel(sid);
      const s = getCurrentSession();
      if (s?.engine_sid) {
        updateServerStatus(true);
        log(`새 세션: ${sid} | engine: ${s.engine_sid}`);
      } else {
        updateServerStatus(false, s?.engine_start_error || "engine_sid missing");
        log(`새 세션: ${sid} | engine 연결 실패`);
      }
    }
  });

  DOM.btnBackToActive.addEventListener("click", () => {
    const p = getProfile(STATE.nickname);
    if (p.activeSessionId) switchToSession(p.activeSessionId, refreshAll);
  });

  document.querySelectorAll('input[name="pace-tag"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      const s = getCurrentSession();
      if (s && !STATE.viewMode) s.stepTags[STATE.currentStep] = e.target.value;
    });
  });
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  initDOM();
  bindEvents();
  updateStreamInfo();
  renderStepTabs(null);
  selectStep(1);
  updateButtons();
  log("Extreme v0 | BFF mode");
  log("닉네임 입력 → Enter → 세션 자동 생성");
});

window.addEventListener("beforeunload", () => {
  try { stopRecording(); } catch (e) {}
});