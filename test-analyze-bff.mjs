const BASE = "https://extreme-rhythme.netlify.app";

function makeSyntheticWav({ durationSec = 35, sampleRate = 16000 } = {}) {
  const numSamples = durationSec * sampleRate;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 3.0;

    let value = 0;
    if (cycle >= 0.5) {
      value = Math.floor(0.25 * 32767 * Math.sin(2 * Math.PI * 220 * t));
    }

    view.setInt16(offset, value, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

const startRes = await fetch(`${BASE}/api/engine-start`, { method: "POST" });
const start = await startRes.json();

console.log("START:", start);

if (!start.ok || !start.sid) {
  throw new Error("engine-start failed");
}

const meta = {
  sid: start.sid,
  uid: "test_user",
  stage_id: 1,
  nickname: "test",
  client_sid: "ex_synthetic_wav_test",
};

console.log("META:", JSON.stringify(meta));

const wavBlob = makeSyntheticWav();

const fd = new FormData();
fd.append("file", wavBlob, "synthetic_test.wav");
fd.append("meta", JSON.stringify(meta));

const analyzeRes = await fetch(`${BASE}/api/engine-analyze`, {
  method: "POST",
  body: fd,
});

const text = await analyzeRes.text();

console.log("STATUS:", analyzeRes.status);
console.log("BODY:", text);
