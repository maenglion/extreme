// ============================================================
// CASP Extreme v0 — UI Actions
// ============================================================
import { STEP_LABELS } from "../config.js";
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { DOM } from "./dom.js";
import { highlightStepResult } from "./render.js";

export function selectStep(step) {
  const session=getCurrentSession();
  if(!STATE.viewMode&&session){
    const cur=session.steps[STATE.currentStep];
    if(cur&&(cur.isRecording||cur.isPaused)){alert("녹음 중. 먼저 Stop.");return;}
  }
  STATE.currentStep=step;
  document.querySelectorAll(".step-tab").forEach(el=>{
    el.classList.toggle("active",parseInt(el.dataset.step)===step);
  });
  DOM.stepLabel.textContent=`S${step}: ${STEP_LABELS[step]||"토론"+(step-1)}`;
  if(session){
    const tag=session.stepTags[step]||"";
    document.querySelectorAll('input[name="pace-tag"]').forEach(r=>{r.checked=r.value===tag;});
  }
  highlightStepResult(step);
  updateButtons();
}

export function updateButtons() {
  const session=getCurrentSession();
  const sd=session?session.steps[STATE.currentStep]:null;
  const isRec=sd?(sd.isRecording||sd.isPaused):false;

  if(STATE.viewMode){
    DOM.btnRecord.disabled=true;DOM.btnPause.disabled=true;DOM.btnStop.disabled=true;
    DOM.btnPause.textContent="⏸";DOM.btnPause.classList.remove("paused");
    const hasDone=session&&Object.values(session.steps).some(s=>s.isDone&&s.result);
    DOM.btnAnalyze.disabled=!hasDone;
    document.querySelectorAll('input[name="pace-tag"]').forEach(r=>{r.disabled=true;});
    DOM.nickname.disabled=true;
  } else {
    DOM.nickname.disabled=false;
    document.querySelectorAll('input[name="pace-tag"]').forEach(r=>{r.disabled=false;});
    DOM.btnRecord.disabled=!session||isRec||(sd&&sd.isDone);
    DOM.btnPause.disabled=!isRec;
    if(sd&&sd.isRecording){DOM.btnPause.textContent="⏸";DOM.btnPause.classList.remove("paused");}
    else if(sd&&sd.isPaused){DOM.btnPause.textContent="▶";DOM.btnPause.classList.add("paused");}
    else{DOM.btnPause.textContent="⏸";DOM.btnPause.classList.remove("paused");}
    DOM.btnStop.disabled=!isRec;
    const hasDone=session&&Object.values(session.steps).some(s=>s.isDone&&s.result);
    DOM.btnAnalyze.disabled=!hasDone||isRec;
  }
}