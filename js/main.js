// 시뮬레이터 진입점: 모듈을 연결하고 초기화한다.
import { init, hooks, restore, resetAll, readRaw, getState, toast } from "./sim.js";
import { initTimeline, renderTimeline } from "./timeline.js";
import { storageAvailable, loadSimInputs, saveSimInputs, clearSimInputs } from "./storage.js";
import { share } from "./share.js";
import { track, getVariant, markInputComplete, maybeTrackReturnVisit } from "./track.js";

const $ = (id) => document.getElementById(id);

// ── 저장 ─────────────────────────────────────────
const canStore = storageAvailable();
if (!canStore) {
  $("storageNotice").hidden = false;
  $("saveNote").textContent = "이 브라우저에서는 입력값이 저장되지 않아요.";
}
let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSimInputs(readRaw(), { submitted: getState().submitted }), 250);
};
hooks.onInput.push(persist);
hooks.onSubmit.push(() => saveSimInputs(readRaw(), { submitted: true }));

// ── A/B: 그래프 전용 버전은 도면 영역만 숨긴다 ─────────────
const variant = getVariant();
document.documentElement.dataset.variant = variant;
$("planCard").hidden = variant === "graph";

// ── 화면 ─────────────────────────────────────────
initTimeline();
hooks.onRender.push(renderTimeline);
init();

const params = new URLSearchParams(window.location.search);
const fromQuiz = params.get("from") === "quiz";
const saved = loadSimInputs();
if (saved) {
  restore(saved.raw, saved.submitted);
} else {
  // 퀴즈에서 넘어온 월 적립액 추천값(소득 × 20%)을 기본값으로 채운다
  const save = params.get("save");
  if (fromQuiz && /^\d{1,6}$/.test(save || "")) {
    $("inP").value = save;
    $("inP").dispatchEvent(new Event("input"));
  }
}

// ── 이벤트 ────────────────────────────────────────
track("sim_enter", { from: fromQuiz ? "quiz" : "direct" });
maybeTrackReturnVisit(!!saved);
hooks.onSubmit.push((_values, { first }) => {
  if (!first) return;
  track("input_complete", { has_period: !!_values.N });
  markInputComplete();
});
hooks.onShare.push((res) => track("report_share", { method: res.method }));

// 유입용 파라미터는 기억했으니 주소창에서 지운다(공유·북마크 시 섞이지 않게). QA용 ab, debug는 남긴다
if (["from", "type", "save", "ref", "utm_source"].some((k) => params.has(k))) {
  ["from", "type", "save", "ref", "utm_source"].forEach((k) => params.delete(k));
  const q = params.toString();
  history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
}

// ── 버튼 ─────────────────────────────────────────
$("editBtn").addEventListener("click", () => {
  $("inputSection").scrollIntoView({ behavior: "smooth", block: "start" });
  $("inA").focus({ preventScroll: true });
});

$("resetBtn").addEventListener("click", () => {
  clearSimInputs();
  resetAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("입력값을 지웠어요.");
});

$("shareBtn").addEventListener("click", async () => {
  const res = await share();
  if (res.done) {
    if (res.method === "copy") toast("링크를 복사했어요.");
    hooks.onShare.forEach((fn) => fn(res));
  } else if (res.reason === "copy_failed") {
    toast("복사하지 못했어요. 주소창의 링크를 직접 복사해 주세요.");
  }
});
