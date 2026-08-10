// ============================================================
// CASP Extreme v0 — Recorder
// ============================================================
import { STATE, getCurrentSession, now } from "../state/sessionStore.js";
import { DOM, log } from "../ui/dom.js";
import { updateButtons } from "../ui/actions.js";
import { renderStepResult, highlightStepResult, renderSessionList } from "../ui/render.js";
import { requestStepAnalyze } from "../api/extremeApi.js";
import { acquireTabAudio, updateStreamInfo } from "./tabAudio.js";

let _timerId = null;
let _elapsedMs = 0;
let _activeStartedAt = null;

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function currentElapsedMs(at = performance.now()) {
  return _elapsedMs + (_activeStartedAt == null ? 0 : Math.max(0, at - _activeStartedAt));
}

function renderTimer(label = "녹음 중", className = "active") {
  DOM.recordStatus.textContent = `${label} ${formatElapsed(currentElapsedMs())}`;
  DOM.recordStatus.className = `record-status${className ? ` ${className}` : ""}`;
}

function clearTimerInterval() {
  if (_timerId != null) clearInterval(_timerId);
  _timerId = null;
}

function startElapsedTimer() {
  clearTimerInterval();
  _elapsedMs = 0;
  _activeStartedAt = performance.now();
  renderTimer();
  _timerId = setInterval(() => {
    if (STATE.mediaRecorder?.state === "recording") renderTimer();
  }, 250);
}

function pauseElapsedTimer() {
  if (_activeStartedAt != null) {
    _elapsedMs = currentElapsedMs();
    _activeStartedAt = null;
  }
  clearTimerInterval();
  renderTimer("일시정지", "paused");
}

function resumeElapsedTimer() {
  if (_activeStartedAt == null) _activeStartedAt = performance.now();
  renderTimer();
  clearTimerInterval();
  _timerId = setInterval(() => {
    if (STATE.mediaRecorder?.state === "recording") renderTimer();
  }, 250);
}

function finishElapsedTimer(label = "녹음 완료") {
  if (_activeStartedAt != null) {
    _elapsedMs = currentElapsedMs();
    _activeStartedAt = null;
  }
  clearTimerInterval();
  renderTimer(label, "");
  return Math.round(_elapsedMs);
}

export async function startRecording() {
  if(STATE.viewMode)return;
  if(!STATE.nickname){alert("Nickname 입력");return;}
  const session=getCurrentSession();
  if(!session){alert("New Session 먼저");return;}
  const step=STATE.currentStep,sd=session.steps[step];
  if(sd.isDone){alert("이미 완료된 Step");return;}
  const ok=await acquireTabAudio();if(!ok)return;

  const as=new MediaStream([STATE.audioTrack]);
  const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
  const rec=new MediaRecorder(as,{mimeType:mime});
  let recordingFailed=false;
  STATE.mediaRecorder=rec;
  sd.chunksCount=0;
  sd._chunks=[];
  sd._mime=mime;

  rec.ondataavailable=(e)=>{
    if(e.data&&e.data.size>0){
      sd._chunks.push(e.data);
      sd.chunksCount++;
    }
  };
  rec.onstart=()=>{
    startElapsedTimer();
  };
  rec.onpause=()=>{
    pauseElapsedTimer();
  };
  rec.onresume=()=>{
    resumeElapsedTimer();
  };
  rec.onstop=async ()=>{
    sd.isRecording=false;sd.isPaused=false;sd.isDone=!recordingFailed;
    sd.voiceActiveMs=finishElapsedTimer(recordingFailed ? "녹음 오류" : "녹음 완료");session.updatedAt=now();

    sd.audioBlob=new Blob(sd._chunks||[],{type:sd._mime||"audio/webm"});
    log(`S${step} done (${sd.chunksCount}ch, ${(sd.audioBlob.size/1024).toFixed(1)}KB)`);

    if(recordingFailed){
      updateButtons();renderSessionList();
      return;
    }

    // 방어: Blob이 너무 작으면 서버 전송 스킵
    if (!sd.audioBlob || sd.audioBlob.size < 1024) {
      log(`[recording-error] S${step} audioBlob too small (${sd.audioBlob?.size || 0} bytes)`);
      sd.isDone = false;
      renderTimer("녹음 실패", "");
      updateButtons();
      renderSessionList();
      return;
    }

    document.querySelector(`.step-tab[data-step="${step}"]`)?.classList.add("recorded");
    renderTimer("분석 중 · 구간", "analyzing");

    await autoStepSummary(step,session);
    renderTimer(sd.result?.ok === false ? "분석 실패 · 구간" : "분석 완료 · 구간", "");
    updateButtons();renderSessionList();
  };
  rec.onerror=()=>{
    recordingFailed=true;
    sd.voiceActiveMs=finishElapsedTimer("녹음 오류");
    sd.isRecording=false;sd.isPaused=false;updateButtons();
  };

  rec.start(1000);
  sd.isRecording=true;sd.isPaused=false;
  DOM.recordStatus.textContent="녹음 중 00:00";DOM.recordStatus.className="record-status active";
  updateButtons();log(`S${step} 녹음 시작`);
}

export function pauseRecording() {
  if(STATE.viewMode)return;
  const s=getCurrentSession();if(!s)return;
  const sd=s.steps[STATE.currentStep];
  if(sd.isRecording&&STATE.mediaRecorder?.state==="recording"){
    STATE.mediaRecorder.pause();sd.isRecording=false;sd.isPaused=true;
    updateButtons();log(`S${STATE.currentStep} pause`);
  }else if(sd.isPaused&&STATE.mediaRecorder?.state==="paused"){
    STATE.mediaRecorder.resume();sd.isRecording=true;sd.isPaused=false;
    updateButtons();log(`S${STATE.currentStep} resume`);
  }
}

let _ctrlChannel = null;

export function initCtrlChannel(sessionId) {
  if(_ctrlChannel) _ctrlChannel.close();
  _ctrlChannel = new BroadcastChannel(`extreme-ctrl:${sessionId}`);
  _ctrlChannel.onmessage = (e) => {
    if(e.data?.type === "STOP_ALL") {
      log("[broadcast] STOP 수신 — 녹음/캡처 종료");
      hardStop();
    }
  };
}

function hardStop() {
  if(STATE.mediaRecorder && STATE.mediaRecorder.state !== "inactive"){
    STATE.mediaRecorder.stop();
  }else if(_timerId != null || _activeStartedAt != null){
    finishElapsedTimer("녹음 종료");
  }
  if(STATE.displayStream){
    STATE.displayStream.getTracks().forEach(t => t.stop());
    STATE.displayStream = null;
    STATE.audioTrack = null;
  }
  updateStreamInfo();
}

export function stopRecording() {
  hardStop();
  if(_ctrlChannel){
    try { _ctrlChannel.postMessage({ type: "STOP_ALL" }); } catch(e){}
  }
}

async function autoStepSummary(step,session) {
  const sd=session.steps[step];
  const result = await requestStepAnalyze(step, sd);
  sd.result = result;
  renderStepResult(step,sd.result);highlightStepResult(step);updateButtons();
}
