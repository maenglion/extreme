// ============================================================
// CASP Extreme v0 — Render
// ============================================================
import { STEP_COUNT, STEP_LABELS, METRICS, DELTA_METRICS } from "../config.js";
import { STATE, getCurrentSession, switchToSession, getProfile } from "../state/sessionStore.js";
import { DOM } from "./dom.js";
import { selectStep, updateButtons } from "./actions.js";

export function refreshAll() {
  const s=getCurrentSession();
  STATE.currentStep=1;
  renderSessionList();
  renderViewBadge();
  renderStepTabs(s);
  selectStep(1);
  renderAllStepResults(s);
  renderOverall(s);
  renderDelta(s);
  updateButtons();
  DOM.sidDisplay.textContent=s?s.sid:"—";
}

export function renderViewBadge() {
  if(STATE.viewMode){
    DOM.viewBadge.textContent="📖 읽기 전용";DOM.viewBadge.style.display="inline-block";
    DOM.btnBackToActive.style.display="inline-block";
  } else {
    DOM.viewBadge.style.display="none";DOM.btnBackToActive.style.display="none";
  }
}

export function renderSessionList() {
  if(!STATE.nickname){DOM.sessionList.innerHTML='<p class="placeholder">닉네임 입력 후 표시</p>';return;}
  const p=getProfile(STATE.nickname);
  if(p.sessions.length===0){DOM.sessionList.innerHTML='<p class="placeholder">세션 없음</p>';return;}
  const viewSid=STATE.viewMode?STATE.viewingSid:p.activeSessionId;
  DOM.sessionList.innerHTML=p.sessions.slice().reverse().map(s=>{
    const isAct=s.sid===p.activeSessionId;
    const isView=s.sid===viewSid;
    const done=Object.values(s.steps).filter(st=>st.isDone).length;
    const pct=Math.round(done/STEP_COUNT*100);
    const time=new Date(s.createdAt).toLocaleTimeString();
    return `<div class="session-item ${isAct?"active-session":"past-session"} ${isView?"viewing":""}" data-sid="${s.sid}">
      <div class="session-item-top"><span class="session-sid">${s.sid.slice(-10)}</span>${isAct?'<span class="session-active-badge">LIVE</span>':""}</div>
      <div class="session-item-bottom"><span>${time}</span><span>S${done}/${STEP_COUNT}</span></div>
      <div class="session-progress"><div class="session-progress-bar" style="width:${pct}%"></div></div></div>`;
  }).join("");
  DOM.sessionList.querySelectorAll(".session-item").forEach(el=>{
    el.addEventListener("click",()=>switchToSession(el.dataset.sid, refreshAll));
  });
}

export function renderStepTabs(session) {
  DOM.stepTabs.innerHTML="";
  for(let i=1;i<=STEP_COUNT;i++){
    const t=document.createElement("div");
    t.className="step-tab";t.dataset.step=i;t.textContent=`S${i}`;
    if(session&&session.steps[i].isDone) t.classList.add("recorded");
    if(i===STATE.currentStep) t.classList.add("active");
    t.addEventListener("click",()=>selectStep(i));
    DOM.stepTabs.appendChild(t);
  }
}

export function renderAllStepResults(session) {
  DOM.stepResultArea.innerHTML="";if(!session)return;
  for(let s=1;s<=STEP_COUNT;s++){if(session.steps[s].result)renderStepResult(s,session.steps[s].result);}
}

export function renderStepResult(step,data) {
  let c=document.getElementById(`step-result-${step}`);
  if(!c){c=document.createElement("div");c.id=`step-result-${step}`;c.className="result-card";DOM.stepResultArea.appendChild(c);}
  c.innerHTML=`<div class="result-card-header"><span class="result-step-badge">S${step}</span><span class="result-step-label">${STEP_LABELS[step]||""}</span></div>
    <div class="result-metrics">${METRICS.map(m=>`<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m,data[m])}</span></div>`).join("")}</div>`;
  c.classList.add("visible");
}

export function highlightStepResult(step) {
  document.querySelectorAll(".result-card").forEach(el=>{el.classList.toggle("highlighted",el.id===`step-result-${step}`);});
}

export function renderOverall(session) {
  if(!session?.overall){DOM.overallResultArea.innerHTML='<p class="placeholder">Analyze로 Overall 계산</p>';return;}
  const o=session.overall;
  DOM.overallResultArea.innerHTML=`<div class="result-card overall-card visible">
    <div class="result-card-header"><span class="result-step-badge overall-badge">Overall</span><span class="result-step-label">가중평균 (${o._steps}steps, ${o._totalDuration.toFixed(1)}s)</span></div>
    <div class="result-metrics">${METRICS.map(m=>`<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m,o[m])}</span></div>`).join("")}</div></div>`;
}

export function renderDelta(session) {
  if(!session){DOM.deltaArea.innerHTML="";return;}
  const base=session.steps[1].result;
  if(!base){DOM.deltaArea.innerHTML='<p class="placeholder">S1 완료 후 Delta 표시</p>';return;}
  let rows="";
  for(let s=2;s<=STEP_COUNT;s++){
    const d=session.steps[s].result;if(!d)continue;
    const cells=DELTA_METRICS.map(m=>{const v=d[m]-base[m];return `<td class="${v>0?"delta-pos":v<0?"delta-neg":""}">${v>=0?"+":""}${formatMetric(m,v)}</td>`;}).join("");
    rows+=`<tr><td class="delta-step-label">S${s}</td>${cells}</tr>`;
  }
  if(!rows){DOM.deltaArea.innerHTML='<p class="placeholder">S2+ 완료 후 Delta 표시</p>';return;}
  DOM.deltaArea.innerHTML=`<table class="delta-table"><thead><tr><th></th>${DELTA_METRICS.map(m=>`<th>Δ${m}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function formatMetric(name,value) {
  if(value==null)return "—";
  if(name.includes("ratio"))return (value*100).toFixed(1)+"%";
  if(name.includes("ms"))return Math.round(value)+"ms";
  if(name.includes("rms"))return value.toFixed(4);
  return typeof value==="number"?value.toFixed(2):value;
}