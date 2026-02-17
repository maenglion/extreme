// ============================================================
// CASP Extreme v0 — Entry Point (ES Module)
// ============================================================
import { API_BASE, STEP_COUNT, METRICS, isServerConfigured } from "./config.js";
import { STATE, getCurrentSession, getProfile, startNewSession, switchToSession, now } from "./state/sessionStore.js";
import { DOM, initDOM, log } from "./ui/dom.js";
import { refreshAll, renderStepTabs, renderOverall, renderDelta } from "./ui/render.js";
import { selectStep, updateButtons } from "./ui/actions.js";
import { updateStreamInfo, _injectStopRecording } from "./audio/tabAudio.js";
import { startRecording, pauseRecording, stopRecording, initCtrlChannel } from "./audio/recorder.js";
import { fetchReport } from "./api/extremeApi.js";
import { fakeSleep } from "./mock/mockResult.js";

// Wire circular dependency: tabAudio needs stopRecording from recorder
_injectStopRecording(stopRecording);

// ── Analyze Session (Overall) ──
// 서버 있으면 /engine/report에서 가져오고, 없으면 프론트 가중평균
async function analyzeSession() {
  const session=getCurrentSession();if(!session)return;
  if(isServerConfigured()&&!session.engine_sid){
    log("[engine] engine_sid missing — Overall 분석 불가. /engine/start 확인 필요.");
    return;
  }
  const done=[];
  for(let s=1;s<=STEP_COUNT;s++){if(session.steps[s].isDone&&session.steps[s].result)done.push(s);}
  if(done.length===0){alert("완료된 Step 없음");return;}

  DOM.btnAnalyze.disabled=true;
  DOM.btnAnalyze.querySelector(".btn-text").textContent="⏳ 분석 중...";

  // 서버 모드: Report 엔드포인트에서 Overall/Delta 수신
  if(isServerConfigured()&&session.engine_sid){
    const report=await fetchReport();
    if(report&&report.overall){
      session.overall=report.overall;session.updatedAt=now();
      renderOverall(session);renderDelta(session);
      log(`Overall 완료 (서버 report)`);
      DOM.btnAnalyze.querySelector(".btn-text").textContent="📊 Analyze (Overall)";
      DOM.btnAnalyze.disabled=false;
      return;
    }
    log("[report] 서버 응답 없음, 프론트 계산으로 fallback");
  }

  // Fallback: 프론트 가중평균
  await fakeSleep(400);
  let totalDur=0;
  done.forEach(s=>{totalDur+=session.steps[s].result.voice_duration_sec||1;});
  const overall={};
  METRICS.forEach(m=>{let ws=0;done.forEach(s=>{ws+=((session.steps[s].result[m]||0)*((session.steps[s].result.voice_duration_sec||1)/totalDur));});overall[m]=ws;});
  overall._steps=done.length;overall._totalDuration=totalDur;
  session.overall=overall;session.updatedAt=now();

  renderOverall(session);renderDelta(session);
  log(`Overall 완료 (${done.length} steps, 프론트 계산)`);
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
        initCtrlChannel(sid);
        const s=getCurrentSession();
        log(`새 세션: ${sid}${s?.engine_sid?" | engine:"+s.engine_sid:""}`);
      }
    }else{
      // 기존 세션 복원 시에도 채널 초기화
      const s=getCurrentSession();
      if(s) initCtrlChannel(s.sid);
      refreshAll();
    }
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
      initCtrlChannel(sid);
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

// 탭/창 닫힐 때 캡처 트랙 강제 종료 → "공유중" 배너 제거
window.addEventListener("beforeunload", () => {
  try { stopRecording(); } catch(e){}
});