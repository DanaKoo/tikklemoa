// 이벤트 트래킹 + A/B 배정.
// - 공통 속성: variant(실험 버전), ref(유입 채널), quiz_type(퀴즈 유형)
// - 입력한 금액은 절대 이벤트에 싣지 않는다 (FORBIDDEN_PROPS로 한 번 더 막음)
// - 분석 도구가 정해지면 window.tikklemoaAnalytics = (event) => {...} 로 연결한다.
//   그 전에는 개발·프리뷰 환경(또는 ?debug=1)에서 콘솔에 찍는다.
import { KEYS, readJSON, writeJSON } from "./storage.js";
import { PRODUCTION_HOSTS } from "./config.js";

export const VARIANTS = ["plan", "graph"]; // plan = 도면 버전, graph = 그래프 전용 버전
export const QUIZ_TYPES = ["latte", "delivery", "impulse", "subscription", "saver", "unplanned"];
export const EVENTS = [
  "quiz_landing_view", "quiz_start", "quiz_complete", "sim_enter",
  "input_complete", "report_share", "return_visit", "report_subscribe",
];
const FORBIDDEN_PROPS = ["A", "P", "ra", "T", "N", "amount", "asset", "monthly", "target", "email"];
const DAY = 24 * 60 * 60 * 1000;

const params = new URLSearchParams(window.location.search);
let memVariant = null; // 저장소를 못 쓸 때 이 페이지 안에서만 유지

function meta() { return readJSON(KEYS.meta) || {}; }
function setMeta(patch) { writeJSON(KEYS.meta, { ...meta(), ...patch }); }

/** A/B 배정: 처음 온 사용자를 50:50 무작위 배정하고 저장. QA용 ?ab=plan|graph 로 덮어쓸 수 있다 */
export function getVariant() {
  const forced = params.get("ab");
  if (VARIANTS.includes(forced)) {
    writeJSON(KEYS.ab, { v: 1, variant: forced, assignedAt: new Date().toISOString(), forced: true });
    memVariant = forced;
    return forced;
  }
  const saved = readJSON(KEYS.ab);
  if (saved && VARIANTS.includes(saved.variant)) return saved.variant;
  if (memVariant) return memVariant;
  const v = Math.random() < 0.5 ? "plan" : "graph";
  memVariant = v;
  writeJSON(KEYS.ab, { v: 1, variant: v, assignedAt: new Date().toISOString() });
  return v;
}

/** 유입 채널: URL의 ref(없으면 utm_source)를 기억하고, 없으면 마지막으로 기억한 값 또는 direct */
export function getRef() {
  const fromUrl = params.get("ref") || params.get("utm_source");
  if (fromUrl) {
    const ref = fromUrl.slice(0, 40).replace(/[^\w.-]/g, "");
    setMeta({ ref });
    return ref || "direct";
  }
  return meta().ref || "direct";
}

export function setQuizType(type) {
  if (QUIZ_TYPES.includes(type)) writeJSON(KEYS.quiz, { v: 1, type, at: new Date().toISOString() });
}

export function getQuizType() {
  const t = params.get("type");
  if (QUIZ_TYPES.includes(t)) { setQuizType(t); return t; }
  const saved = readJSON(KEYS.quiz);
  return saved && QUIZ_TYPES.includes(saved.type) ? saved.type : null;
}

function debugEnabled() {
  return params.get("debug") === "1" || !PRODUCTION_HOSTS.includes(window.location.hostname);
}

const common = { variant: getVariant(), ref: getRef(), quiz_type: getQuizType() };

export function track(name, props = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(props)) if (!FORBIDDEN_PROPS.includes(k)) clean[k] = v;
  const event = { event: name, ts: new Date().toISOString(), ...common, quiz_type: getQuizType(), ...clean };
  (window.__tmEvents = window.__tmEvents || []).push(event);
  try { if (typeof window.tikklemoaAnalytics === "function") window.tikklemoaAnalytics(event); } catch { /* 분석 도구 오류가 화면을 깨지 않게 */ }
  if (debugEnabled()) console.info("[tikklemoa:event]", name, event);
  return event;
}

/** 첫 input_complete 시각 기록 (재방문 판정 기준) */
export function markInputComplete() {
  if (!meta().firstInputCompleteAt) setMeta({ firstInputCompleteAt: new Date().toISOString() });
}

/**
 * 재방문: 첫 input_complete 후 1~30일 안에, 저장된 입력값이 있는 채로 다시 방문.
 * 같은 날 여러 번 열어도 하루 1회만 보낸다.
 */
export function maybeTrackReturnVisit(hasSavedInputs, now = new Date()) {
  if (!hasSavedInputs) return null;
  const m = meta();
  if (!m.firstInputCompleteAt) return null;
  const elapsed = now - new Date(m.firstInputCompleteAt);
  if (!(elapsed >= DAY && elapsed <= 30 * DAY)) return null;
  const today = now.toISOString().slice(0, 10);
  if (m.lastReturnVisitDay === today) return null;
  setMeta({ lastReturnVisitDay: today });
  return track("return_visit", { days_since_first: Math.floor(elapsed / DAY) });
}

export const commonProps = common;
