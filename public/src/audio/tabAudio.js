// ============================================================
// CASP Extreme v0 — Tab Audio Capture
// ============================================================
import { STATE, getCurrentSession } from "../state/sessionStore.js";
import { DOM, log } from "../ui/dom.js";
import { updateButtons } from "../ui/actions.js";

// stopRecording is lazily resolved to break circular dependency (tabAudio ↔ recorder)
let _stopRecording = null;
export function _injectStopRecording(fn) { _stopRecording = fn; }

export async function acquireTabAudio() {
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
      if(s){const sd=s.steps[STATE.currentStep];if(sd.isRecording||sd.isPaused)if(_stopRecording)_stopRecording();}
      updateStreamInfo();
    };
    updateStreamInfo();log("탭 오디오 획득");return true;
  }catch(e){log(`탭 오디오 실패: ${e.message}`);return false;}
}

export function updateStreamInfo() {
  if(STATE.audioTrack&&STATE.audioTrack.readyState==="live"){
    DOM.streamInfo.textContent="🟢 탭 오디오 연결됨";DOM.streamInfo.className="stream-info connected";
  }else{
    DOM.streamInfo.textContent="⚫ 탭 오디오 없음";DOM.streamInfo.className="stream-info disconnected";
  }
}