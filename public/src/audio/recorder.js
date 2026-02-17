// ============================================================
// CASP Extreme v0 — Recorder
// ============================================================
import { STATE, getCurrentSession, now } from "../state/sessionStore.js";
import { DOM, log } from "../ui/dom.js";
import { updateButtons } from "../ui/actions.js";
import { renderStepResult, highlightStepResult, renderSessionList } from "../ui/render.js";
import { requestStepAnalyze } from "../api/extremeApi.js";
import { acquireTabAudio } from "./tabAudio.js";

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
  rec.onstop=async ()=>{
    sd.isRecording=false;sd.isPaused=false;sd.isDone=true;
    sd.voiceActiveMs=sd.chunksCount*1000;session.updatedAt=now();

    // 단일 Blob 생성
    sd.audioBlob=new Blob(sd._chunks||[],{type:sd._mime||"audio/webm"});
    log(`S${step} done (${sd.chunksCount}ch, ${(sd.audioBlob.size/1024).toFixed(1)}KB)`);

    document.querySelector(`.step-tab[data-step="${step}"]`)?.classList.add("recorded");
    DOM.recordStatus.textContent="";DOM.recordStatus.className="record-status";

    await autoStepSummary(step,session);
    updateButtons();renderSessionList();
  };
  rec.onerror=()=>{sd.isRecording=false;sd.isPaused=false;updateButtons();};

  rec.start(1000);
  sd.isRecording=true;sd.isPaused=false;
  DOM.recordStatus.textContent=`● REC S${step}`;DOM.recordStatus.className="record-status active";
  updateButtons();log(`S${step} 녹음 시작`);
}

export function pauseRecording() {
  if(STATE.viewMode)return;
  const s=getCurrentSession();if(!s)return;
  const sd=s.steps[STATE.currentStep];
  if(sd.isRecording&&STATE.mediaRecorder?.state==="recording"){
    STATE.mediaRecorder.pause();sd.isRecording=false;sd.isPaused=true;
    DOM.recordStatus.textContent=`⏸ S${STATE.currentStep}`;DOM.recordStatus.className="record-status paused";
    updateButtons();log(`S${STATE.currentStep} pause`);
  }else if(sd.isPaused&&STATE.mediaRecorder?.state==="paused"){
    STATE.mediaRecorder.resume();sd.isRecording=true;sd.isPaused=false;
    DOM.recordStatus.textContent=`● REC S${STATE.currentStep}`;DOM.recordStatus.className="record-status active";
    updateButtons();log(`S${STATE.currentStep} resume`);
  }
}

// ── BroadcastChannel: 창 간 STOP 동기화 ──
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

// ── 캡처 트랙 + 레코더 강제 종료 ──
function hardStop() {
  // 1. MediaRecorder 종료
  if(STATE.mediaRecorder && STATE.mediaRecorder.state !== "inactive"){
    STATE.mediaRecorder.stop();
  }
  // 2. displayMedia 캡처 트랙 종료 → "공유중" 배너 제거
  if(STATE.displayStream){
    STATE.displayStream.getTracks().forEach(t => t.stop());
    STATE.displayStream = null;
    STATE.audioTrack = null;
  }
  updateStreamInfo();
}

export function stopRecording() {
  hardStop();
  // 다른 창에도 STOP 신호 전파
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