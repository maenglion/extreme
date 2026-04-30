import fs from "node:fs";

const BASE = "https://extreme-rhythme.netlify.app";
const filePath = "C:/tmp/casp_test.mp3";

// 1) engine sid 받기
const startRes = await fetch(`${BASE}/api/engine-start`, { method: "POST" });
const start = await startRes.json();

console.log("START:", start);

if (!start.ok || !start.sid) {
  throw new Error("engine-start failed");
}

// 2) meta 구성
const meta = {
  sid: start.sid,
  uid: "test_user",
  stage_id: 1,
  nickname: "test",
  client_sid: "ex_mp3_file_test",
};

console.log("META:", JSON.stringify(meta));

// 3) 실제 mp3 파일 읽기
if (!fs.existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}

const bytes = fs.readFileSync(filePath);
console.log("FILE_BYTES:", bytes.length);

const blob = new Blob([bytes], { type: "audio/mpeg" });

// 4) FormData 구성
const fd = new FormData();
fd.append("file", blob, "casp_test.mp3");
fd.append("meta", JSON.stringify(meta));

// 5) analyze 호출
const analyzeRes = await fetch(`${BASE}/api/engine-analyze`, {
  method: "POST",
  body: fd,
});

const text = await analyzeRes.text();

console.log("STATUS:", analyzeRes.status);
console.log("BODY:", text);