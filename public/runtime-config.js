// ============================================================
// CASP Extreme v0 — Runtime Configuration (SSOT)
// 배포 환경에 맞게 아래 URL만 변경하면 됩니다.
// ============================================================
  // public/runtime-config.js
window.RUNTIME_CONFIG = {
  API_BASE: "https://casp-engine-api-357918245340.asia-northeast3.run.app",
  API_KEY_HASH: "fdc7dcf8225d71b984f029ce2a94246ebd9f344cd7deb5b227c03e426765106d",
};


// ⚠️ 이 키는 내부 테스트용. 프로덕션에서는 서비스 서버가 프록시해서 숨겨야 함.
// ⚠️ DB 비밀번호 / OAuth Secret 등 절대 금지