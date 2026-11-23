// localStorage 래퍼. 시크릿 모드·차단 환경에서도 예외를 던지지 않는다.
export const KEYS = {
  sim: "tikklemoa:sim:v1",     // 시뮬레이터 입력값
  ab: "tikklemoa:ab:v1",       // A/B 배정
  meta: "tikklemoa:meta:v1",   // 첫 input_complete 시각, 유입 채널 등
  quiz: "tikklemoa:quiz:v1",   // 퀴즈 결과 유형
};

let available = null;

export function storageAvailable() {
  if (available !== null) return available;
  try {
    const k = "tikklemoa:__probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function readJSON(key) {
  if (!storageAvailable()) return null;
  try {
    const s = window.localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key, value) {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // 용량 초과 등
  }
}

export function removeKey(key) {
  if (!storageAvailable()) return;
  try { window.localStorage.removeItem(key); } catch { /* 무시 */ }
}

// ── 시뮬레이터 입력값 ────────────────────────────────
export function loadSimInputs() {
  const d = readJSON(KEYS.sim);
  if (!d || d.v !== 1 || typeof d.raw !== "object") return null;
  return d;
}

export function saveSimInputs(raw, { submitted }) {
  const clean = {};
  for (const k of ["A", "P", "ra", "T", "N"]) clean[k] = raw[k] == null ? "" : String(raw[k]);
  return writeJSON(KEYS.sim, { v: 1, raw: clean, submitted: !!submitted, savedAt: new Date().toISOString() });
}

export function clearSimInputs() {
  removeKey(KEYS.sim);
}
