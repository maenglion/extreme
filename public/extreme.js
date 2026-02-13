// ============================================================
// CASP Extreme v0 — Frontend Logic (PC-only, Internal)
// ============================================================

// ── API Base (SSOT: runtime-config.js) ──
const API_BASE = window.__RHYTHME_API_BASE__ || "";

function isServerConfigured() {
  return API_BASE !== "";
}

// ── Session ──
function generateSID() {
  return "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}
let sid = generateSID();

// ── Step별 데이터 구조 ──
function createStepState() {
  return {
    isRecording: false,
    chunksCount: 0,
    voiceActiveMs: 0, // placeholder — 서버 응답으로 교체 예정
    result: null,
  };
}

// ── State ──
const STATE = {
  // Session 전체
  nickname: "",
  dimension: "overall",
  target: 50,
  protocol: "extreme_v0",
  currentStep: 1,
  // Tab audio stream (재사용)
  displayStream: null,
  audioTrack: null,
  mediaRecorder: null,
  // Step별 상태 (1~5)
  steps: {
    1: createStepState(),
    2: createStepState(),
    3: createStepState(),
    4: createStepState(),
    5: createStepState(),
  },
  // fast/mid/slow 태그
  stepTag: {},
};

const STEP_LABELS = {
  1: "Baseline (편하게 말하기)",
  2: "토론 1",
  3: "토론 2",
  4: "토론 3",
  5: "토론 4",
};

const METRICS = [
  "tempo_proxy",
  "silence_ratio",
  "pause_count_per_min",
  "pause_mean_ms",
  "restart_proxy",
  "f0_median",
  "f0_range",
  "rms_median",
  "rms_range",
];

const DELTA_METRICS = [
  "silence_ratio",
  "f0_range",
  "rms_range",
  "restart_proxy",
];

// ── DOM refs (lazy) ──
let DOM = {};
function initDOM() {
  DOM = {
    nickname: document.getElementById("nickname"),
    dimension: document.getElementById("dimension"),
    target: document.getElementById("target"),
    targetValue: document.getElementById("target-value"),
    sidDisplay: document.getElementById("sid-display"),
    serverStatus: document.getElementById("server-status"),
    stepTabs: document.getElementById("step-tabs"),
    stepLabel: document.getElementById("step-label"),
    btnRecord: document.getElementById("btn-record"),
    btnAnalyze: document.getElementById("btn-analyze"),
    recordStatus: document.getElementById("record-status"),
    tagGroup: document.getElementById("tag-group"),
    stepResultArea: document.getElementById("step-result-area"),
    overallResultArea: document.getElementById("overall-result-area"),
    deltaArea: document.getElementById("delta-area"),
    streamInfo: document.getElementById("stream-info"),
    logArea: document.getElementById("log-area"),
  };
  DOM.sidDisplay.textContent = sid;
  // 서버 상태 표시
  if (isServerConfigured()) {
    DOM.serverStatus.textContent = `API: ${API_BASE}`;
    DOM.serverStatus.className = "server-status configured";
  } else {
    DOM.serverStatus.textContent = "⚠ Server not configured";
    DOM.serverStatus.className = "server-status not-configured";
  }
}

// ── Logging ──
function log(msg) {
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${msg}`;
  console.log(line);
  if (DOM.logArea) {
    DOM.logArea.textContent += line + "\n";
    DOM.logArea.scrollTop = DOM.logArea.scrollHeight;
  }
}

// ── Step Tab 전환 ──
function selectStep(step) {
  const current = STATE.steps[STATE.currentStep];
  if (current && current.isRecording) {
    alert("녹음 중입니다. 먼저 Stop 하세요.");
    return;
  }
  STATE.currentStep = step;
  // UI 업데이트
  document.querySelectorAll(".step-tab").forEach((el) => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle("active", s === step);
    if (STATE.steps[s].chunksCount > 0) {
      el.classList.add("recorded");
    }
  });
  DOM.stepLabel.textContent = `Step ${step}: ${STEP_LABELS[step]}`;
  // tag 복원
  const savedTag = STATE.stepTag[step] || "";
  document.querySelectorAll('input[name="pace-tag"]').forEach((r) => {
    r.checked = r.value === savedTag;
  });
  // 결과 하이라이트
  highlightStepResult(step);
  updateButtons();
  log(`Step ${step} 선택됨`);
}

// ── 버튼 상태 업데이트 ──
function updateButtons() {
  const step = STATE.currentStep;
  const stepData = STATE.steps[step];
  DOM.btnRecord.textContent = stepData.isRecording ? "⏹ Stop" : "🔴 Record";
  DOM.btnRecord.classList.toggle("recording", stepData.isRecording);
  DOM.btnAnalyze.disabled = stepData.chunksCount === 0 || stepData.isRecording;
}

// ── Tab Audio 캡처 ──
async function acquireTabAudio() {
  // 이미 활성 스트림이 있으면 재사용
  if (STATE.displayStream && STATE.audioTrack && STATE.audioTrack.readyState === "live") {
    log("기존 탭 오디오 스트림 재사용");
    return true;
  }
  try {
    log("탭 오디오 공유 요청 중...");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    // 비디오 트랙 즉시 종료
    stream.getVideoTracks().forEach((t) => t.stop());
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert("⚠️ 탭 공유에서 '오디오 공유'를 체크해야 합니다.");
      log("ERROR: 오디오 트랙 없음");
      return false;
    }
    STATE.displayStream = stream;
    STATE.audioTrack = audioTracks[0];
    // 트랙 종료 감지
    STATE.audioTrack.onended = () => {
      log("탭 오디오 트랙 종료됨 (사용자가 공유 중단)");
      STATE.displayStream = null;
      STATE.audioTrack = null;
      // 현재 녹음 중이면 강제 종료
      const currentStepData = STATE.steps[STATE.currentStep];
      if (currentStepData.isRecording) {
        stopRecording();
      }
      updateStreamInfo();
    };
    updateStreamInfo();
    log("탭 오디오 획득 성공");
    return true;
  } catch (err) {
    log(`탭 오디오 획득 실패: ${err.message}`);
    alert("탭 공유가 취소되었거나 실패했습니다.");
    return false;
  }
}

function updateStreamInfo() {
  if (STATE.audioTrack && STATE.audioTrack.readyState === "live") {
    DOM.streamInfo.textContent = "🟢 탭 오디오 연결됨";
    DOM.streamInfo.className = "stream-info connected";
  } else {
    DOM.streamInfo.textContent = "⚫ 탭 오디오 없음";
    DOM.streamInfo.className = "stream-info disconnected";
  }
}

// ── Recording (MediaRecorder + chunk streaming) ──
async function startRecording() {
  if (!STATE.nickname) {
    alert("Nickname을 입력하세요.");
    DOM.nickname.focus();
    return;
  }
  const acquired = await acquireTabAudio();
  if (!acquired) return;

  const step = STATE.currentStep;
  const stepData = STATE.steps[step];
  const audioStream = new MediaStream([STATE.audioTrack]);

  // MIME 선택
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  const recorder = new MediaRecorder(audioStream, { mimeType });
  STATE.mediaRecorder = recorder;
  stepData.chunksCount = 0;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      uploadChunk(e.data, step, stepData.chunksCount);
      stepData.chunksCount++;
    }
  };

  recorder.onstop = () => {
    log(`Step ${step} 녹음 종료 (${stepData.chunksCount} chunks)`);
    stepData.isRecording = false;
    stepData.voiceActiveMs = stepData.chunksCount * 1000; // placeholder 추정
    // step tab에 recorded 표시
    document.querySelector(`.step-tab[data-step="${step}"]`)?.classList.add("recorded");
    updateButtons();
    DOM.recordStatus.textContent = "";
    DOM.recordStatus.classList.remove("active");
    // 서버에 stream end 알림
    notifyStreamEnd(step);
  };

  recorder.onerror = (e) => {
    log(`MediaRecorder 에러: ${e.error?.message || "unknown"}`);
    stepData.isRecording = false;
    updateButtons();
  };

  // 서버에 stream start 알림
  notifyStreamStart(step);

  // 1초 단위 chunk
  recorder.start(1000);
  stepData.isRecording = true;
  DOM.recordStatus.textContent = `● REC Step ${step}`;
  DOM.recordStatus.classList.add("active");
  updateButtons();
  log(`Step ${step} 녹음 시작 (${mimeType})`);
}

function stopRecording() {
  if (STATE.mediaRecorder && STATE.mediaRecorder.state !== "inactive") {
    STATE.mediaRecorder.stop();
  }
}

function toggleRecording() {
  const stepData = STATE.steps[STATE.currentStep];
  if (stepData.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// ── API: Chunk Upload (placeholder) ──
function uploadChunk(blob, step, chunkIndex) {
  if (!isServerConfigured()) {
    console.log(`[no-server] chunk ${chunkIndex} (step ${step}, ${blob.size}B) — 전송 안 함`);
    return;
  }
  const url = `${API_BASE}/extreme/stream/chunk`;
  const formData = new FormData();
  formData.append("audio", blob, `chunk_${chunkIndex}.webm`);
  formData.append("sid", sid);
  formData.append("step", step);
  formData.append("chunk_index", chunkIndex);
  fetch(url, { method: "POST", body: formData }).catch((e) => {
    console.warn(`chunk ${chunkIndex} 전송 실패`, e.message);
  });
}

// ── API: Stream Start/End Notification ──
function getMeta(step) {
  return {
    sid,
    nickname: STATE.nickname,
    dimension: STATE.dimension,
    target: STATE.target,
    protocol: STATE.protocol,
    step,
    pace_tag: STATE.stepTag[step] || "",
  };
}

function notifyStreamStart(step) {
  if (!isServerConfigured()) {
    log(`[no-server] stream/start (step ${step}) — 전송 안 함`);
    return;
  }
  const url = `${API_BASE}/extreme/stream/start`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getMeta(step)),
  })
    .then((r) => log(`stream/start → ${r.status}`))
    .catch((e) => log(`stream/start 실패: ${e.message}`));
}

function notifyStreamEnd(step) {
  if (!isServerConfigured()) {
    log(`[no-server] stream/end (step ${step}) — 전송 안 함`);
    return;
  }
  const url = `${API_BASE}/extreme/stream/end`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getMeta(step)),
  })
    .then((r) => log(`stream/end → ${r.status}`))
    .catch((e) => log(`stream/end 실패: ${e.message}`));
}

// ── API: Analyze ──
async function analyzeStep() {
  const step = STATE.currentStep;
  const stepData = STATE.steps[step];

  if (stepData.chunksCount === 0) {
    alert("이 Step은 아직 녹음되지 않았습니다.");
    return;
  }

  DOM.btnAnalyze.disabled = true;
  DOM.btnAnalyze.textContent = "⏳ 분석 중...";
  log(`Step ${step} 분석 요청...`);

  // 서버 미설정 → mock으로 대체
  if (!isServerConfigured()) {
    log(`[no-server] 서버 미설정 — Mock 결과 사용`);
    await fakeSleep(600); // UX용 딜레이
    const mock = generateMockResult(step);
    stepData.result = mock;
    renderStepResult(step, mock);
    renderDelta();
    renderOverall();
    DOM.btnAnalyze.textContent = "📊 Analyze";
    DOM.btnAnalyze.disabled = false;
    return;
  }

  // 서버 설정됨 → 실제 API 호출
  const url = `${API_BASE}/extreme/analyze`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getMeta(step)),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    log(`Step ${step} 분석 완료`);
    stepData.result = data;
    renderStepResult(step, data);
    renderDelta();
    renderOverall();
  } catch (e) {
    log(`Step ${step} 분석 실패: ${e.message}`);
    alert(`분석 실패: ${e.message}`);
  } finally {
    DOM.btnAnalyze.textContent = "📊 Analyze";
    DOM.btnAnalyze.disabled = false;
  }
}

function fakeSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Mock data (서버 미연결 시 테스트용) ──
function generateMockResult(step) {
  const stepData = STATE.steps[step];
  const base = {
    tempo_proxy: 3.8 + Math.random() * 1.5,
    silence_ratio: 0.2 + Math.random() * 0.3,
    pause_count_per_min: 5 + Math.random() * 10,
    pause_mean_ms: 300 + Math.random() * 500,
    restart_proxy: 1 + Math.random() * 4,
    f0_median: 120 + Math.random() * 80,
    f0_range: 30 + Math.random() * 60,
    rms_median: 0.02 + Math.random() * 0.05,
    rms_range: 0.01 + Math.random() * 0.03,
    voice_duration_sec: (stepData.voiceActiveMs || stepData.chunksCount * 1000) / 1000,
  };
  // step이 높을수록 약간 변화 (토론 효과 시뮬레이션)
  if (step > 1) {
    base.silence_ratio *= 0.8 + Math.random() * 0.4;
    base.f0_range *= 0.7 + Math.random() * 0.6;
    base.restart_proxy *= 0.9 + Math.random() * 0.3;
  }
  return base;
}

// ── Rendering: Step Result ──
function renderStepResult(step, data) {
  let container = document.getElementById(`step-result-${step}`);
  if (!container) {
    container = document.createElement("div");
    container.id = `step-result-${step}`;
    container.className = "result-card";
    DOM.stepResultArea.appendChild(container);
  }

  container.innerHTML = `
    <div class="result-card-header">
      <span class="result-step-badge">Step ${step}</span>
      <span class="result-step-label">${STEP_LABELS[step]}</span>
    </div>
    <div class="result-metrics">
      ${METRICS.map((m) => `
        <div class="metric-item">
          <span class="metric-name">${m}</span>
          <span class="metric-value">${formatMetric(m, data[m])}</span>
        </div>
      `).join("")}
    </div>
  `;
  container.classList.add("visible");
  highlightStepResult(step);
}

function highlightStepResult(step) {
  document.querySelectorAll(".result-card").forEach((el) => {
    el.classList.toggle("highlighted", el.id === `step-result-${step}`);
  });
}

// ── Rendering: Delta ──
function renderDelta() {
  const base = STATE.steps[1].result;
  if (!base) {
    DOM.deltaArea.innerHTML = '<p class="placeholder">Step 1 (Baseline) 분석 후 Delta가 표시됩니다.</p>';
    return;
  }

  let rows = "";
  for (let s = 2; s <= 5; s++) {
    const d = STATE.steps[s].result;
    if (!d) continue;
    const cells = DELTA_METRICS.map((m) => {
      const delta = d[m] - base[m];
      const cls = delta > 0 ? "delta-pos" : delta < 0 ? "delta-neg" : "";
      return `<td class="${cls}">${delta >= 0 ? "+" : ""}${formatMetric(m, delta)}</td>`;
    }).join("");
    rows += `<tr><td class="delta-step-label">Step ${s}</td>${cells}</tr>`;
  }

  if (!rows) {
    DOM.deltaArea.innerHTML = '<p class="placeholder">Step 2~5 분석 후 Delta가 표시됩니다.</p>';
    return;
  }

  DOM.deltaArea.innerHTML = `
    <table class="delta-table">
      <thead>
        <tr>
          <th></th>
          ${DELTA_METRICS.map((m) => `<th>Δ${m}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Rendering: Session Overall ──
function renderOverall() {
  const analyzedSteps = [];
  for (let s = 1; s <= 5; s++) {
    if (STATE.steps[s].result) analyzedSteps.push(s);
  }
  if (analyzedSteps.length === 0) {
    DOM.overallResultArea.innerHTML = '<p class="placeholder">분석 결과가 없습니다.</p>';
    return;
  }

  // 유효 발화 시간 가중 평균
  let totalDuration = 0;
  analyzedSteps.forEach((s) => {
    totalDuration += STATE.steps[s].result.voice_duration_sec || 1;
  });

  const overall = {};
  METRICS.forEach((m) => {
    let weightedSum = 0;
    analyzedSteps.forEach((s) => {
      const w = (STATE.steps[s].result.voice_duration_sec || 1) / totalDuration;
      weightedSum += (STATE.steps[s].result[m] || 0) * w;
    });
    overall[m] = weightedSum;
  });

  DOM.overallResultArea.innerHTML = `
    <div class="result-card overall-card visible">
      <div class="result-card-header">
        <span class="result-step-badge overall-badge">Overall</span>
        <span class="result-step-label">Session 가중평균 (${analyzedSteps.length} steps, ${totalDuration.toFixed(1)}s)</span>
      </div>
      <div class="result-metrics">
        ${METRICS.map((m) => `
          <div class="metric-item">
            <span class="metric-name">${m}</span>
            <span class="metric-value">${formatMetric(m, overall[m])}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ── Formatting ──
function formatMetric(name, value) {
  if (value === undefined || value === null) return "—";
  if (name.includes("ratio")) return (value * 100).toFixed(1) + "%";
  if (name.includes("ms")) return Math.round(value) + "ms";
  if (name.includes("rms")) return value.toFixed(4);
  return typeof value === "number" ? value.toFixed(2) : value;
}

// ── Event Binding ──
function bindEvents() {
  // Nickname
  DOM.nickname.addEventListener("input", (e) => {
    STATE.nickname = e.target.value.trim();
  });

  // Dimension
  DOM.dimension.addEventListener("change", (e) => {
    STATE.dimension = e.target.value;
  });

  // Target slider
  DOM.target.addEventListener("input", (e) => {
    STATE.target = parseInt(e.target.value);
    DOM.targetValue.textContent = STATE.target;
  });

  // Step tabs
  document.querySelectorAll(".step-tab").forEach((el) => {
    el.addEventListener("click", () => selectStep(parseInt(el.dataset.step)));
  });

  // Record / Analyze
  DOM.btnRecord.addEventListener("click", toggleRecording);
  DOM.btnAnalyze.addEventListener("click", analyzeStep);

  // Pace tag
  document.querySelectorAll('input[name="pace-tag"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      STATE.stepTag[STATE.currentStep] = e.target.value;
    });
  });

  // New Session
  document.getElementById("btn-new-session")?.addEventListener("click", () => {
    if (!confirm("새 세션을 시작하시겠습니까? 현재 결과가 초기화됩니다.")) return;
    sid = generateSID();
    DOM.sidDisplay.textContent = sid;
    // Step 상태 초기화
    for (let s = 1; s <= 5; s++) {
      STATE.steps[s] = createStepState();
    }
    STATE.stepTag = {};
    DOM.stepResultArea.innerHTML = "";
    DOM.overallResultArea.innerHTML = '<p class="placeholder">분석 결과가 없습니다.</p>';
    DOM.deltaArea.innerHTML = '<p class="placeholder">Step 1 (Baseline) 분석 후 Delta가 표시됩니다.</p>';
    document.querySelectorAll(".step-tab").forEach((el) => el.classList.remove("recorded"));
    selectStep(1);
    log("새 세션 시작: " + sid);
  });
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  initDOM();
  bindEvents();
  selectStep(1);
  updateStreamInfo();
  log(`Extreme v0 초기화 완료 | API: ${API_BASE || "(미설정)"} | SID: ${sid}`);
});