// 시뮬레이터 화면 로직. 계산은 calc.js에만 둔다.
import {
  validateInputs, simulate, formatManwon, formatDuration, formatTargetDate,
} from "./calc.js";

export const PRESET_59_T = 50000; // 59㎡ 예시 목표 금액(만 원) — 지역 시세 아님

const $ = (id) => document.getElementById(id);
const FIELDS = { A: "inA", P: "inP", ra: "inRa", T: "inT", N: "inN" };
const ERR = { A: "errA", P: "errP", ra: "errRa", T: "errT", N: "errN" };

const state = {
  submitted: false, // 결과를 한 번이라도 봤는지 (이후 입력 변경은 실시간 반영)
  touched: new Set(),
  values: null,
};

// ── 입력 처리 ───────────────────────────────────────
function readRaw() {
  const raw = {};
  for (const [k, id] of Object.entries(FIELDS)) raw[k] = $(id).value;
  return raw;
}

function sanitize(el) {
  const decimal = el.inputMode === "decimal";
  let v = el.value.replace(decimal ? /[^\d.]/g : /[^\d]/g, "");
  if (decimal) {
    const i = v.indexOf(".");
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
  }
  if (v !== el.value) el.value = v;
}

function updateKoreanHints() {
  document.querySelectorAll("[data-korean-for]").forEach((hint) => {
    const v = $(hint.dataset.koreanFor).value.trim();
    hint.textContent = v && /^\d+$/.test(v) && Number(v) > 0 ? `= ${formatManwon(Number(v))}` : "";
  });
}

function updatePresetChip() {
  const isPreset = Number($("inT").value) === PRESET_59_T;
  $("preset59").setAttribute("aria-pressed", String(isPreset));
  $("presetNote").hidden = !isPreset;
}

function showErrors(errors, onlyTouched) {
  for (const [k, id] of Object.entries(ERR)) {
    const show = errors[k] && (!onlyTouched || state.touched.has(k));
    $(id).textContent = show ? errors[k] : "";
    $(FIELDS[k]).setAttribute("aria-invalid", show ? "true" : "false");
  }
}

// ── 결과 렌더 ───────────────────────────────────────
function renderSummary(values) {
  const { achieveMonths, in3y, required } = simulate(values);

  if (achieveMonths === null) {
    $("tileAchieve").textContent = "50년 안에 달성하기 어려워요";
    $("tileAchieveSub").textContent = "월 적립액이나 수익률을 조정해 보세요.";
  } else if (achieveMonths === 0) {
    $("tileAchieve").textContent = "이미 달성했어요";
    $("tileAchieveSub").textContent = `목표 금액 ${formatManwon(values.T)}`;
  } else {
    $("tileAchieve").textContent = `${formatDuration(achieveMonths)} 뒤`;
    $("tileAchieveSub").textContent = `${formatTargetDate(achieveMonths)} · 목표 ${formatManwon(values.T)}`;
  }

  $("tile3y").textContent = formatManwon(in3y);

  const reqWrap = $("tileRequiredWrap");
  if (values.N) {
    reqWrap.hidden = false;
    $("tileRequiredLabel").textContent = `${values.N}년 안에 모으려면`;
    $("tileRequired").textContent = required === 0 ? "추가 적립 없이 가능" : `월 ${formatManwon(required)}`;
    $("tileRequiredSub").textContent = required === 0 ? "" : `지금보다 ${diffText(required - values.P)}`;
  } else {
    reqWrap.hidden = true;
  }

  $("reportLine").innerHTML =
    `지금 속도를 유지하면 3년 뒤 예상 자산은 <strong>${formatManwon(in3y)}</strong>입니다.`;
}

function diffText(d) {
  if (d > 0) return `월 ${formatManwon(d)} 더 필요해요`;
  if (d < 0) return `월 ${formatManwon(-d)} 여유가 있어요`;
  return "지금 적립액과 같아요";
}

/** 입력값 변경 → 검증 → (제출 후라면) 결과 갱신 */
function refresh() {
  const { ok, values, errors } = validateInputs(readRaw());
  showErrors(errors, !state.submittedAttempt);
  if (ok) {
    state.values = values;
    if (state.submitted) render(values);
  }
  return { ok, values, errors };
}

function render(values) {
  $("resultSection").hidden = false;
  renderSummary(values);
  hooks.onRender.forEach((fn) => fn(values));
}

function onSubmit(e) {
  e.preventDefault();
  state.submittedAttempt = true;
  const { ok, values, errors } = refresh();
  if (!ok) {
    const first = Object.keys(FIELDS).find((k) => errors[k]);
    if (first) $(FIELDS[first]).focus();
    return;
  }
  const first = !state.submitted;
  state.submitted = true;
  render(values);
  hooks.onSubmit.forEach((fn) => fn(values, { first }));
  $("resultSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

// 다른 모듈(그래프, 도면, 저장, 트래킹)이 붙는 지점
export const hooks = { onRender: [], onSubmit: [], onInput: [] };

export function getState() { return state; }
export function setFieldValues(raw) {
  for (const [k, id] of Object.entries(FIELDS)) {
    if (raw[k] !== undefined && raw[k] !== null) $(id).value = String(raw[k]);
  }
  updateKoreanHints();
  updatePresetChip();
}
export { readRaw, refresh, render };

export function init() {
  if (!$("inT").value) $("inT").value = String(PRESET_59_T);

  for (const [k, id] of Object.entries(FIELDS)) {
    const el = $(id);
    el.addEventListener("input", () => {
      sanitize(el);
      updateKoreanHints();
      if (k === "T") updatePresetChip();
      refresh();
      hooks.onInput.forEach((fn) => fn(readRaw()));
    });
    el.addEventListener("blur", () => {
      if (el.value !== "") state.touched.add(k);
      refresh();
    });
  }

  $("preset59").addEventListener("click", () => {
    $("inT").value = String(PRESET_59_T);
    updateKoreanHints();
    updatePresetChip();
    refresh();
    hooks.onInput.forEach((fn) => fn(readRaw()));
  });

  $("simForm").addEventListener("submit", onSubmit);
  updateKoreanHints();
  updatePresetChip();
}
