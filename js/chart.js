// 성장 그래프: 원금 누적 vs 수익 포함 자산, 목표 금액 수평 점선. x축은 연 단위.
// 호버(터치 포함)하면 가장 가까운 연도의 두 값을 툴팁으로 보여 준다.
import { wealthAt, principalAt, formatManwon } from "./calc.js";

const PAD = { top: 16, right: 12, bottom: 28, left: 44 };
const HEIGHT = 230;

let ctx = null; // { root, values, years, x, y, width, ... }

/** 축 눈금용 짧은 표기: 1.2억, 3,000만 */
export function formatShort(v) {
  if (v >= 10000) {
    const e = v / 10000;
    return `${Number.isInteger(e) ? e : e.toFixed(e >= 10 ? 0 : 1)}억`;
  }
  return `${Math.round(v).toLocaleString("ko-KR")}만`;
}

function niceStep(max, count = 4) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** 표/툴팁에 쓰는 연도별 값 */
export function yearlyRows(values, years) {
  const rows = [];
  for (let y = 0; y <= years; y++) {
    rows.push({ year: y, principal: principalAt(values, y * 12), wealth: wealthAt(values, y * 12) });
  }
  return rows;
}

export function renderChart(root, values, horizonMonths) {
  const years = Math.max(1, Math.ceil(horizonMonths / 12));
  const months = years * 12;
  const width = Math.max(280, Math.round(root.querySelector(".chart-box").clientWidth || 320));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const wealth = [];
  const principal = [];
  for (let m = 0; m <= months; m++) {
    wealth.push(wealthAt(values, m));
    principal.push(principalAt(values, m));
  }
  const maxV = Math.max(values.T, ...wealth, ...principal) * 1.08;
  const step = niceStep(maxV);
  const yMax = Math.ceil(maxV / step) * step;

  const x = (m) => PAD.left + (m / months) * innerW;
  const y = (v) => PAD.top + innerH - (v / yMax) * innerH;

  const path = (arr) => arr.map((v, m) => `${m ? "L" : "M"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join("");

  // x축 눈금: 연 단위, 많으면 건너뛴다
  const every = years <= 6 ? 1 : years <= 12 ? 2 : 5;
  let xTicks = "";
  for (let yr = 0; yr <= years; yr += every) {
    xTicks += `<text x="${x(yr * 12)}" y="${HEIGHT - 8}" class="axis-text" text-anchor="middle">${yr === 0 ? "지금" : `${yr}년`}</text>`;
  }
  let yTicks = "";
  for (let v = 0; v <= yMax + 1e-6; v += step) {
    yTicks += `<line x1="${PAD.left}" x2="${width - PAD.right}" y1="${y(v)}" y2="${y(v)}" class="grid" />`;
    yTicks += `<text x="${PAD.left - 6}" y="${y(v) + 4}" class="axis-text" text-anchor="end">${v === 0 ? "0" : formatShort(v)}</text>`;
  }

  const tY = y(values.T);
  const svg = `
    <svg width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" class="chart-svg" role="img" aria-label="연도별 원금 누적과 수익 포함 자산 그래프. 자세한 값은 표로 보기에서 확인할 수 있어요.">
      ${yTicks}
      <line x1="${PAD.left}" x2="${width - PAD.right}" y1="${tY}" y2="${tY}" class="target-line" />
      <text x="${PAD.left + 6}" y="${tY - 6}" class="target-text" text-anchor="start">목표 ${formatShort(values.T)}</text>
      <path d="${path(principal)}" class="line line-principal" />
      <path d="${path(wealth)}" class="line line-wealth" />
      <line class="now-line" x1="0" x2="0" y1="${PAD.top}" y2="${PAD.top + innerH}" />
      <circle class="now-dot now-principal" r="4.5" cx="0" cy="0" />
      <circle class="now-dot now-wealth" r="4.5" cx="0" cy="0" />
      <line class="hover-line" x1="0" x2="0" y1="${PAD.top}" y2="${PAD.top + innerH}" opacity="0" />
      <circle class="hover-dot hover-principal" r="5" opacity="0" />
      <circle class="hover-dot hover-wealth" r="5" opacity="0" />
      <rect class="hit" x="${PAD.left}" y="0" width="${innerW}" height="${HEIGHT}" fill="transparent" />
    </svg>`;
  const box = root.querySelector(".chart-box");
  box.innerHTML = svg + `<div class="chart-tooltip" role="status" aria-live="polite" hidden></div>`;

  ctx = { root, values, years, months, x, y, width, innerW };
  bindHover();
  renderTable(root, values, years);
}

function bindHover() {
  const { root, values, years, x, y } = ctx;
  const svg = root.querySelector(".chart-svg");
  const hit = svg.querySelector(".hit");
  const tip = root.querySelector(".chart-tooltip");
  const line = svg.querySelector(".hover-line");
  const dw = svg.querySelector(".hover-wealth");
  const dp = svg.querySelector(".hover-principal");

  const show = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const yr = Math.max(0, Math.min(years, Math.round(((px - PAD.left) / ctx.innerW) * years)));
    const m = yr * 12;
    const w = wealthAt(values, m);
    const p = principalAt(values, m);
    const cx = x(m);
    line.setAttribute("x1", cx); line.setAttribute("x2", cx); line.setAttribute("opacity", "1");
    dw.setAttribute("cx", cx); dw.setAttribute("cy", y(w)); dw.setAttribute("opacity", "1");
    dp.setAttribute("cx", cx); dp.setAttribute("cy", y(p)); dp.setAttribute("opacity", "1");
    tip.innerHTML = `
      <div class="tt-title">${yr === 0 ? "지금" : `${yr}년 뒤`}</div>
      <div class="tt-row"><i class="sw sw-wealth"></i>수익 포함 자산<b>${formatManwon(w)}</b></div>
      <div class="tt-row"><i class="sw sw-principal"></i>원금 누적<b>${formatManwon(p)}</b></div>`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = Math.min(Math.max(cx - tw / 2, 0), ctx.width - tw);
    tip.style.left = `${left}px`;
  };
  const hide = () => {
    tip.hidden = true;
    [line, dw, dp].forEach((el) => el.setAttribute("opacity", "0"));
  };
  hit.addEventListener("pointermove", (e) => show(e.clientX));
  hit.addEventListener("pointerdown", (e) => show(e.clientX));
  hit.addEventListener("pointerleave", hide);
}

/** 슬라이더 시점(개월) 표시 */
export function setChartMonth(month) {
  if (!ctx) return;
  const { root, values, x, y } = ctx;
  const m = Math.min(month, ctx.months);
  const cx = x(m);
  const svg = root.querySelector(".chart-svg");
  const nl = svg.querySelector(".now-line");
  nl.setAttribute("x1", cx); nl.setAttribute("x2", cx);
  const nw = svg.querySelector(".now-wealth");
  nw.setAttribute("cx", cx); nw.setAttribute("cy", y(wealthAt(values, m)));
  const np = svg.querySelector(".now-principal");
  np.setAttribute("cx", cx); np.setAttribute("cy", y(principalAt(values, m)));
}

function renderTable(root, values, years) {
  const body = yearlyRows(values, years).map((r) => `
    <tr><th scope="row">${r.year === 0 ? "지금" : `${r.year}년 뒤`}</th>
    <td>${formatManwon(r.principal)}</td><td>${formatManwon(r.wealth)}</td></tr>`).join("");
  root.querySelector(".chart-table tbody").innerHTML = body;
}

export function getChartContext() { return ctx; }
