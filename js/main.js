// 시뮬레이터 진입점: 모듈을 연결하고 초기화한다.
import { init, hooks, restore, resetAll, readRaw, getState, toast } from "./sim.js";
import { initTimeline, renderTimeline } from "./timeline.js";
import { storageAvailable, loadSimInputs, saveSimInputs, clearSimInputs } from "./storage.js";
import { share } from "./share.js";

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

// ── 화면 ─────────────────────────────────────────
initTimeline();
hooks.onRender.push(renderTimeline);
init();

const saved = loadSimInputs();
if (saved) restore(saved.raw, saved.submitted);

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
