// 시점 슬라이더: 한 번 계산한 W(m)를 도면·그래프·숫자·퍼센트에 똑같이 넘겨 항상 일치시킨다.
import {
  wealthAt, fillRatio, fillPercent, formatManwon, formatDuration, formatTargetDate,
  monthsToGoal, horizonMonths,
} from "./calc.js";
import { planSvg, setPlanFill } from "./plan.js";
import { renderChart, setChartMonth } from "./chart.js";

const $ = (id) => document.getElementById(id);
let current = null; // { values, horizon }

/** 슬라이더 시점 m에서 화면에 보이는 값 (테스트·검증에서도 쓴다) */
export function snapshotAt(values, m) {
  const W = wealthAt(values, m);
  return { month: m, wealth: W, ratio: fillRatio(W, values.T), percent: fillPercent(W, values.T) };
}

export function setMonth(m) {
  if (!current) return;
  const { values } = current;
  const s = snapshotAt(values, m);
  $("tlWhen").textContent = m === 0 ? "지금" : `${formatDuration(m)} 뒤`;
  $("tlDate").textContent = m === 0 ? "" : formatTargetDate(m);
  $("tlAmount").textContent = formatManwon(s.wealth);
  $("tlPercent").textContent = `${s.percent}%`;
  $("planPercent").textContent = `${s.percent}%`;
  setPlanFill($("planBox"), s.ratio);
  setChartMonth(m);
  const slider = $("timeSlider");
  slider.setAttribute("aria-valuetext", `${$("tlWhen").textContent}, ${formatManwon(s.wealth)}, 목표 대비 ${s.percent}%`);
  // 현재 상태를 DOM에 남겨 자동 점검에서 일치 여부를 확인할 수 있게 한다
  slider.dataset.wealth = String(s.wealth);
  slider.dataset.percent = String(s.percent);
}

export function renderTimeline(values) {
  const achieve = monthsToGoal(values);
  const horizon = horizonMonths(achieve);
  const slider = $("timeSlider");
  const prevMax = Number(slider.max);
  const prevVal = Number(slider.value);
  const wasAtEnd = !current || prevVal === prevMax;

  current = { values, horizon };
  if (!$("planBox").firstElementChild) $("planBox").innerHTML = planSvg();
  renderChart($("chartCard"), values, horizon);

  slider.max = String(horizon);
  // 처음에는 달성 시점(또는 30년)에 두고, 입력을 고치는 중에는 사용자가 둔 위치를 유지한다
  const m = wasAtEnd ? horizon : Math.min(prevVal, horizon);
  slider.value = String(m);
  $("tlMaxLabel").textContent =
    achieve === horizon ? `${formatDuration(horizon)} (달성)` : formatDuration(horizon);
  setMonth(m);
}

export function initTimeline() {
  $("timeSlider").addEventListener("input", (e) => setMonth(Number(e.target.value)));
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!current) return;
      renderChart($("chartCard"), current.values, current.horizon);
      setMonth(Number($("timeSlider").value));
    }, 150);
  });
}
