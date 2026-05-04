// ============================================================
// CASP Extreme v0 — Config (SSOT)
// BFF 모드: /api/* 경유. API_BASE 직접 연결 없음.
// ============================================================

export const API_BASE = "";
export function isServerConfigured() { return true; }

export const STEP_COUNT = 10;
export const STEP_LABELS = {
  1:"Baseline", 2:"토론1", 3:"토론2", 4:"토론3", 5:"토론4",
  6:"토론5", 7:"토론6", 8:"토론7", 9:"토론8", 10:"토론9",
};

// 서버 features_preview 기준 표시 지표
export const PREVIEW_METRICS = [
  "pause_ratio", "silence_ratio", "clipping_ratio",
  "snr_db_proxy", "energy_decay", "speech_rate_proxy",
  // Day 3 추가
  "f0_median", "f0_range_st", "voiced_ratio",
  "delta_f0_peak", "pause_event_count", "long_pause_count",
];

export const SCORE_KEYS = ["FS_v0", "SCS_v0", "ERS_v0", "VSI_v0"];

export const DELTA_METRICS = [
  "pause_ratio", "silence_ratio", "energy_decay", "speech_rate_proxy",
  // Day 3 추가
  "f0_median", "f0_range_st", "voiced_ratio",
];

// 구버전 호환
export const METRICS = PREVIEW_METRICS;