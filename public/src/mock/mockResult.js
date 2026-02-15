// ============================================================
// CASP Extreme v0 — Mock Result Generator
// ============================================================

export function fakeSleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

export function generateMockResult(step,sd) {
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