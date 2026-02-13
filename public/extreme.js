// ============================================================
// CASP Extreme v0 — Frontend Logic (PC-only, Internal)
// ============================================================

const API_BASE = window.__RHYTHME_API_BASE__ || "";
function isServerConfigured() { return API_BASE !== ""; }

const STEP_COUNT = 10;
const STEP_LABELS = {
  1:"Baseline", 2:"토론1", 3:"토론2", 4:"토론3", 5:"토론4",
  6:"토론5", 7:"토론6", 8:"토론7", 9:"토론8", 10:"토론9",
};
const METRICS = [
  "tempo_proxy","silence_ratio","pause_count_per_min","pause_mean_ms",
  "restart_proxy","f0_median","f0_range","rms_median","rms_range",
];
const DELTA_METRICS = ["silence_ratio","f0_range","rms_range","restart_proxy"];

function generateSID() { return "ex_"+Date.now()+"_"+Math.random().toString(36).slice(2,8); }
function now() { return new Date().toISOString(); }
function fakeSleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function createStepState() {
  return { isRecording:false, isPaused:false, isDone:false, chunksCount:0, voiceActiveMs:0, result:null };
}
function createSteps() { const s={}; for(let i=1;i<=STEP_COUNT;i++) s[i]=createStepState(); return s; }
function createSession(sid) { return { sid, createdAt:now(), updatedAt:now(), steps:createSteps(), overall:null, stepTags:{} }; }

// ── Profiles ──
const profiles = {};
function getProfile(n) { if(!profiles[n]) profiles[n]={activeSessionId:null,sessions:[]}; return profiles[n]; }
function getActiveSession(n) { const p=getProfile(n); return p.sessions.find(s=>s.sid===p.activeSessionId)||null; }
function findSession(n,sid) { return getProfile(n).sessions.find(s=>s.sid===sid)||null; }

// ── State ──
const STATE = {
  nickname:"", dimension:"baseline", target:50, protocol:"extreme_v0",
  currentStep:1, viewMode:false, viewingSid:null,
  displayStream:null, audioTrack:null, mediaRecorder:null,
};

// ── DOM ──
let DOM={};
function initDOM() {
  DOM = {
    nickname:document.getElementById("nickname"),
    dimension:document.getElementById("dimension"),
    target:document.getElementById("target"),
    targetValue:document.getElementById("target-value"),
    sidDisplay:document.getElementById("sid-display"),
    serverStatus:document.getElementById("server-status"),
    viewBadge:document.getElementById("view-badge"),
    stepTabs:document.getElementById("step-tabs"),
    stepLabel:document.getElementById("step-label"),
    btnRecord:document.getElementById("btn-record"),
    btnPause:document.getElementById("btn-pause"),
    btnStop:document.getElementById("btn-stop"),
    btnAnalyze:document.getElementById("btn-analyze"),
    btnNewSession:document.getElementById("btn-new-session"),
    btnBackToActive:document.getElementById("btn-back-to-active"),
    recordStatus:document.getElementById("record-status"),
    stepResultArea:document.getElementById("step-result-area"),
    overallResultArea:document.getElementById("overall-result-area"),
    deltaArea:document.getElementById("delta-area"),
    streamInfo:document.getElementById("stream-info"),
    sessionList:document.getElementById("session-list"),
    logArea:document.getElementById("log-area"),
  };
  if(isServerConfigured()){
    DOM.serverStatus.textContent=`API: ${API_BASE}`;
    DOM.serverStatus.className="server-status configured";
  } else {
    DOM.serverStatus.textContent="⚠ Server not configured";
    DOM.serverStatus.className="server-status not-configured";
  }
}

function log(msg) {
  const t=new Date().toLocaleTimeString();
  const line=`[${t}] ${msg}`;
  console.log(line);
  if(DOM.logArea){DOM.logArea.textContent+=line+"\n";DOM.logArea.scrollTop=DOM.logArea.scrollHeight;}
}

// ══════════════════════════════════════
//  SESSION
// ══════════════════════════════════════

function startNewSession() {
  if(!STATE.nickname){alert("Nickname 먼저 입력");DOM.nickname.focus();return;}
  const p=getProfile(STATE.nickname);
  const sid=generateSID();
  p.sessions.push(createSession(sid));
  p.activeSessionId=sid;
  STATE.viewMode=false;STATE.viewingSid=null;
  log(`새 세션: ${sid}`);
  refreshAll();
}
function switchToSession(sid) {
  const p=getProfile(STATE.nickname);
  if(sid===p.activeSessionId){STATE.viewMode=false;STATE.viewingSid=null;}
  else{STATE.viewMode=true;STATE.viewingSid=sid;}
  refreshAll();
}
function getCurrentSession() {
  if(!STATE.nickname) return null;
  if(STATE.viewMode&&STATE.viewingSid) return findSession(STATE.nickname,STATE.viewingSid);
  return getActiveSession(STATE.nickname);
}

// ══════════════════════════════════════
//  REFRESH
// ══════════════════════════════════════

function refreshAll() {
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

function renderViewBadge() {
  if(STATE.viewMode){
    DOM.viewBadge.textContent="📖 읽기 전용";DOM.viewBadge.style.display="inline-block";
    DOM.btnBackToActive.style.display="inline-block";
  } else {
    DOM.viewBadge.style.display="none";DOM.btnBackToActive.style.display="none";
  }
}

function renderSessionList() {
  if(!STATE.nickname){DOM.sessionList.innerHTML='<p class="placeholder">닉네임 입력 후 표시</p>';return;}
  const p=getProfile(STATE.nickname);
  if(p.sessions.length===0){DOM.sessionList.innerHTML='<p class="placeholder">세션 없음</p>';return;}
  const viewSid=STATE.viewMode?STATE.viewingSid:p.activeSessionId;
  DOM.sessionList.innerHTML=p.sessions.slice().reverse().map(s=>{
    const isAct=s.sid===p.activeSessionId;
    const isView=s.sid===viewSid;
    const done=Object.values(s.steps).filter(st=>st.isDone).length;
    const time=new Date(s.createdAt).toLocaleTimeString();
    return `<div class="session-item ${isAct?"active-session":"past-session"} ${isView?"viewing":""}" data-sid="${s.sid}">
      <div class="session-item-top"><span class="session-sid">${s.sid.slice(-10)}</span>${isAct?'<span class="session-active-badge">LIVE</span>':""}</div>
      <div class="session-item-bottom"><span>${time}</span><span>${done}/${STEP_COUNT}</span></div></div>`;
  }).join("");
  DOM.sessionList.querySelectorAll(".session-item").forEach(el=>{
    el.addEventListener("click",()=>switchToSession(el.dataset.sid));
  });
}

function renderStepTabs(session) {
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

function selectStep(step) {
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

function updateButtons() {
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

// ══════════════════════════════════════
//  TAB AUDIO
// ══════════════════════════════════════

async function acquireTabAudio() {
  if(STATE.displayStream&&STATE.audioTrack&&STATE.audioTrack.readyState==="live"){log("탭 오디오 재사용");return true;}
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    stream.getVideoTracks().forEach(t=>t.stop());
    const at=stream.getAudioTracks();
    if(at.length===0){alert("⚠️ '오디오 공유' 체크 필요");return false;}
    STATE.displayStream=stream;STATE.audioTrack=at[0];
    STATE.audioTrack.onended=()=>{
      STATE.displayStream=null;STATE.audioTrack=null;
      const s=getCurrentSession();
      if(s){const sd=s.steps[STATE.currentStep];if(sd.isRecording||sd.isPaused)stopRecording();}
      updateStreamInfo();
    };
    updateStreamInfo();log("탭 오디오 획득");return true;
  }catch(e){log(`탭 오디오 실패: ${e.message}`);return false;}
}
function updateStreamInfo() {
  if(STATE.audioTrack&&STATE.audioTrack.readyState==="live"){
    DOM.streamInfo.textContent="🟢 탭 오디오 연결됨";DOM.streamInfo.className="stream-info connected";
  }else{
    DOM.streamInfo.textContent="⚫ 탭 오디오 없음";DOM.streamInfo.className="stream-info disconnected";
  }
}

// ══════════════════════════════════════
//  RECORDING
// ══════════════════════════════════════

async function startRecording() {
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
  STATE.mediaRecorder=rec;sd.chunksCount=0;

  rec.ondataavailable=(e)=>{if(e.data.size>0){uploadChunk(e.data,step,sd.chunksCount);sd.chunksCount++;}};
  rec.onstop=()=>{
    sd.isRecording=false;sd.isPaused=false;sd.isDone=true;
    sd.voiceActiveMs=sd.chunksCount*1000;session.updatedAt=now();
    document.querySelector(`.step-tab[data-step="${step}"]`)?.classList.add("recorded");
    DOM.recordStatus.textContent="";DOM.recordStatus.className="record-status";
    log(`S${step} done (${sd.chunksCount}ch)`);
    notifyStreamEnd(step);autoStepSummary(step,session);updateButtons();renderSessionList();
  };
  rec.onerror=()=>{sd.isRecording=false;sd.isPaused=false;updateButtons();};

  notifyStreamStart(step);rec.start(1000);
  sd.isRecording=true;sd.isPaused=false;
  DOM.recordStatus.textContent=`● REC S${step}`;DOM.recordStatus.className="record-status active";
  updateButtons();log(`S${step} 녹음 시작`);
}

function pauseRecording() {
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

function stopRecording() {
  if(STATE.mediaRecorder&&STATE.mediaRecorder.state!=="inactive") STATE.mediaRecorder.stop();
}

async function autoStepSummary(step,session) {
  const sd=session.steps[step];
  if(isServerConfigured()){
    try{
      const r=await fetch(`${API_BASE}/extreme/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      sd.result=await r.json();
    }catch(e){sd.result=generateMockResult(step,sd);}
  }else{
    await fakeSleep(300);sd.result=generateMockResult(step,sd);
    log(`[no-server] S${step} mock`);
  }
  renderStepResult(step,sd.result);highlightStepResult(step);updateButtons();
}

// ══════════════════════════════════════
//  NETWORK
// ══════════════════════════════════════

function getMeta(step) {
  const s=getCurrentSession();
  return {sid:s?.sid||"",nickname:STATE.nickname,dimension:STATE.dimension,target:STATE.target,protocol:STATE.protocol,step,pace_tag:s?.stepTags[step]||""};
}
function uploadChunk(blob,step,idx) {
  if(!isServerConfigured()){console.log(`[no-server] chunk ${idx} S${step}`);return;}
  const fd=new FormData();fd.append("audio",blob,`chunk_${idx}.webm`);fd.append("sid",getCurrentSession()?.sid||"");fd.append("step",step);fd.append("chunk_index",idx);
  fetch(`${API_BASE}/extreme/stream/chunk`,{method:"POST",body:fd}).catch(()=>{});
}
function notifyStreamStart(step) {
  if(!isServerConfigured()){log(`[no-server] stream/start S${step}`);return;}
  fetch(`${API_BASE}/extreme/stream/start`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))}).catch(()=>{});
}
function notifyStreamEnd(step) {
  if(!isServerConfigured()){log(`[no-server] stream/end S${step}`);return;}
  fetch(`${API_BASE}/extreme/stream/end`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getMeta(step))}).catch(()=>{});
}

// ══════════════════════════════════════
//  ANALYZE (세션 Overall)
// ══════════════════════════════════════

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

// ══════════════════════════════════════
//  MOCK
// ══════════════════════════════════════

function generateMockResult(step,sd) {
  const b={
    tempo_proxy:3.8+Math.random()*1.5,silence_ratio:0.2+Math.random()*0.3,
    pause_count_per_min:5+Math.random()*10,pause_mean_ms:300+Math.random()*500,
    restart_proxy:1+Math.random()*4,f0_median:120+Math.random()*80,
    f0_range:30+Math.random()*60,rms_median:0.02+Math.random()*0.05,
    rms_range:0.01+Math.random()*0.03,
    voice_duration_sec:((sd?.voiceActiveMs||5000)/1000),
  };
  if(step>1){b.silence_ratio*=0.8+Math.random()*0.4;b.f0_range*=0.7+Math.random()*0.6;}
  return b;
}

// ══════════════════════════════════════
//  RENDER
// ══════════════════════════════════════

function renderAllStepResults(session) {
  DOM.stepResultArea.innerHTML="";if(!session)return;
  for(let s=1;s<=STEP_COUNT;s++){if(session.steps[s].result)renderStepResult(s,session.steps[s].result);}
}
function renderStepResult(step,data) {
  let c=document.getElementById(`step-result-${step}`);
  if(!c){c=document.createElement("div");c.id=`step-result-${step}`;c.className="result-card";DOM.stepResultArea.appendChild(c);}
  c.innerHTML=`<div class="result-card-header"><span class="result-step-badge">S${step}</span><span class="result-step-label">${STEP_LABELS[step]||""}</span></div>
    <div class="result-metrics">${METRICS.map(m=>`<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m,data[m])}</span></div>`).join("")}</div>`;
  c.classList.add("visible");
}
function highlightStepResult(step) {
  document.querySelectorAll(".result-card").forEach(el=>{el.classList.toggle("highlighted",el.id===`step-result-${step}`);});
}
function renderOverall(session) {
  if(!session?.overall){DOM.overallResultArea.innerHTML='<p class="placeholder">Analyze로 Overall 계산</p>';return;}
  const o=session.overall;
  DOM.overallResultArea.innerHTML=`<div class="result-card overall-card visible">
    <div class="result-card-header"><span class="result-step-badge overall-badge">Overall</span><span class="result-step-label">가중평균 (${o._steps}steps, ${o._totalDuration.toFixed(1)}s)</span></div>
    <div class="result-metrics">${METRICS.map(m=>`<div class="metric-item"><span class="metric-name">${m}</span><span class="metric-value">${formatMetric(m,o[m])}</span></div>`).join("")}</div></div>`;
}
function renderDelta(session) {
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
function formatMetric(name,value) {
  if(value==null)return "—";
  if(name.includes("ratio"))return (value*100).toFixed(1)+"%";
  if(name.includes("ms"))return Math.round(value)+"ms";
  if(name.includes("rms"))return value.toFixed(4);
  return typeof value==="number"?value.toFixed(2):value;
}

// ══════════════════════════════════════
//  EVENTS
// ══════════════════════════════════════

function bindEvents() {
  DOM.nickname.addEventListener("change",(e)=>{
    const n=e.target.value.trim();if(!n)return;
    STATE.nickname=n;STATE.viewMode=false;STATE.viewingSid=null;
    const p=getProfile(n);
    if(!p.activeSessionId)startNewSession();else refreshAll();
    log(`닉네임: ${n}`);
  });
  DOM.dimension.addEventListener("change",(e)=>{STATE.dimension=e.target.value;});
  DOM.target.addEventListener("input",(e)=>{STATE.target=parseInt(e.target.value);DOM.targetValue.textContent=STATE.target;});
  DOM.btnRecord.addEventListener("click",startRecording);
  DOM.btnPause.addEventListener("click",pauseRecording);
  DOM.btnStop.addEventListener("click",stopRecording);
  DOM.btnAnalyze.addEventListener("click",analyzeSession);
  DOM.btnNewSession.addEventListener("click",startNewSession);
  DOM.btnBackToActive.addEventListener("click",()=>{
    const p=getProfile(STATE.nickname);if(p.activeSessionId)switchToSession(p.activeSessionId);
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