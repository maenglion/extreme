// ============================================================
// CASP Extreme v0 — Config (SSOT)
// ============================================================

export const API_BASE = window.__RHYTHME_API_BASE__ || "";
export const API_KEY  = window.__CASP_API_KEY__     || "";
export function isServerConfigured() { return API_BASE !== ""; }

export const STEP_COUNT = 10;
export const STEP_LABELS = {
  1:"Baseline", 2:"토론1", 3:"토론2", 4:"토론3", 5:"토론4",
  6:"토론5", 7:"토론6", 8:"토론7", 9:"토론8", 10:"토론9",
};
export const METRICS = [
  "tempo_proxy","silence_ratio","pause_count_per_min","pause_mean_ms",
  "restart_proxy","f0_median","f0_range","rms_median","rms_range",
];
export const DELTA_METRICS = ["silence_ratio","f0_range","rms_range","restart_proxy"];