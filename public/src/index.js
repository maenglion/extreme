// ============================================================
// CASP Extreme v0 — Entry Point (ES Module)
// ============================================================
import { API_BASE, STEP_COUNT, METRICS } from "./config.js";
import { STATE, getCurrentSession, getProfile, startNewSession, switchToSession, now } from "./state/sessionStore.js";
import { DOM, initDOM, log } from "./ui/dom.js";
import { refreshAll, renderStepTabs, renderOverall, renderDelta } from "./ui/render.js";
import { selectStep, updateButtons } from "./ui/actions.js";
import { updateStreamInfo, _injectStopRecording } from "./audio/tabAudio.js";
import { startRecording, pauseRecording, stopRecording } from "./audio/recorder.js";
import { fakeSleep } from "./mock/mockResult.js";

// Wire circular dependency: tabAudio needs stopRecording from recorder
_injectStopRecording(stopRecording);

// ── Analyze Session (Overall 가중평균) ──
async function analyzeSession() {
  const session=getCurrentSession();if(!session)return;
  const done=[];
  for(let s=1;s<=STEP_COUNT;s++){if(session.steps[s].isDone&&session.steps[s].result)done.push(s);}
  if(done.length===0){alert("완료된 Step 없음");return;}

  DOM.btnAnalyze.disabled=true;
  DOM.btnAnalyze.querySelector(".btn-text").textContent="⏳ 분석 중...";
  await fakeSleep(400);

  let totalDur=0;
  done.forEach(s=>{totalDur+=session.steps[s].result.voice_duration_sec||1;});
  const overall={};
  METRICS.forEach(m=>{let ws=0;done.forEach(s=>{ws+=((session.steps[s].result[m]||0)*((session.steps[s].result.voice_duration_sec||1)/totalDur));});overall[m]=ws;});
  overall._steps=done.length;overall._totalDuration=totalDur;
  session.overall=overall;session.updatedAt=now();

  renderOverall(session);renderDelta(session);
  log(`Overall 완료 (${done.length} steps)`);
  DOM.btnAnalyze.querySelector(".btn-text").textContent="📊 Analyze (Overall)";
  DOM.btnAnalyze.disabled=false;
}

// ── Event Binding ──
function bindEvents() {
  DOM.nickname.addEventListener("change",async (e)=>{
    const n=e.target.value.trim();if(!n)return;
    STATE.nickname=n;STATE.viewMode=false;STATE.viewingSid=null;
    const p=getProfile(n);
    if(!p.activeSessionId){
      const sid=await startNewSession(refreshAll);
      if(sid){
        const s=getCurrentSession();
        log(`새 세션: ${sid}${s?.engine_sid?" | engine:"+s.engine_sid:""}`);
      }
    }else{refreshAll();}
    log(`닉네임: ${n}`);
  });
  DOM.dimension.addEventListener("change",(e)=>{STATE.dimension=e.target.value;});
  DOM.target.addEventListener("input",(e)=>{STATE.target=parseInt(e.target.value);DOM.targetValue.textContent=STATE.target;});
  DOM.btnRecord.addEventListener("click",startRecording);
  DOM.btnPause.addEventListener("click",pauseRecording);
  DOM.btnStop.addEventListener("click",stopRecording);
  DOM.btnAnalyze.addEventListener("click",analyzeSession);
  DOM.btnNewSession.addEventListener("click",async ()=>{
    if(!STATE.nickname){alert("Nickname 먼저 입력");DOM.nickname.focus();return;}
    const sid=await startNewSession(refreshAll);
    if(sid){
      const s=getCurrentSession();
      log(`새 세션: ${sid}${s?.engine_sid?" | engine:"+s.engine_sid:""}`);
    }
  });
  DOM.btnBackToActive.addEventListener("click",()=>{
    const p=getProfile(STATE.nickname);if(p.activeSessionId)switchToSession(p.activeSessionId,refreshAll);
  });
  document.querySelectorAll('input[name="pace-tag"]').forEach(r=>{
    r.addEventListener("change",(e)=>{const s=getCurrentSession();if(s&&!STATE.viewMode)s.stepTags[STATE.currentStep]=e.target.value;});
  });
}

// ── Init ──
document.addEventListener("DOMContentLoaded",()=>{
  initDOM();bindEvents();updateStreamInfo();
  renderStepTabs(null);
  selectStep(1);
  updateButtons();
  log(`Extreme v0 | API: ${API_BASE||"(미설정)"}`);
  log("닉네임 입력 → Enter → 세션 자동 생성");
});