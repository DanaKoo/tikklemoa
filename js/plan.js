// 59㎡ 도면 (방 3, 거실, 주방·식당, 욕실 2, 현관)
// 외곽은 10.2m × 5.8m ≈ 59.2㎡ 직사각형이라, 아래에서 위로 차오르는 높이 비율 = 면적 비율이다.
// 좌표 1 = 1cm. 색은 CSS 변수(--plan-*)를 따라 라이트·다크 테마에 맞춰진다.

const W = 1020;
const H = 580;
const WALL = 14;

// [이름, x, y, w, h]
const ROOMS = [
  ["침실 1", 0, 0, 330, 330],
  ["거실", 330, 0, 360, 330],
  ["침실 2", 690, 0, 330, 330],
  ["욕실", 0, 330, 165, 250],
  ["욕실", 165, 330, 165, 250],
  ["주방·식당", 330, 330, 360, 250],
  ["현관", 690, 330, 120, 250],
  ["침실 3", 810, 330, 210, 250],
];

// 문 위치(벽 틈) [x1, y1, x2, y2] — 시각적 힌트용
const DOORS = [
  [330, 230, 330, 300],  // 침실1 ↔ 거실
  [690, 230, 690, 300],  // 침실2 ↔ 거실
  [60, 330, 130, 330],   // 욕실1 ↔ 침실1 (안방 욕실)
  [330, 470, 330, 540],  // 욕실2 ↔ 주방
  [810, 420, 810, 490],  // 침실3 ↔ 현관
  [720, 580, 790, 580],  // 현관문
];

export function planSvg() {
  const rooms = ROOMS.map(([name, x, y, w, h]) => `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" class="plan-room" />
      <text x="${x + w / 2}" y="${y + h / 2}" class="plan-label">${name}</text>`).join("");
  // 문은 벽을 끊는 마스크로 표현한다(아래의 바닥·채움이 그대로 보이도록)
  const doors = DOORS.map(([x1, y1, x2, y2]) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="20" />`).join("");

  return `
  <svg class="plan-svg" viewBox="${-WALL} ${-WALL} ${W + WALL * 2} ${H + WALL * 2}" role="img" aria-labelledby="planSvgTitle">
    <title id="planSvgTitle">59㎡ 도면 채움 정도</title>
    <defs>
      <clipPath id="planClip"><rect x="0" y="0" width="${W}" height="${H}" /></clipPath>
      <mask id="planDoors" maskUnits="userSpaceOnUse" x="${-WALL * 2}" y="${-WALL * 2}" width="${W + WALL * 4}" height="${H + WALL * 4}">
        <rect x="${-WALL * 2}" y="${-WALL * 2}" width="${W + WALL * 4}" height="${H + WALL * 4}" fill="white" />
        ${doors}
      </mask>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" class="plan-floor" />
    <g clip-path="url(#planClip)">
      <rect id="planFill" x="0" y="${H}" width="${W}" height="0" class="plan-fill" />
      <line id="planFillEdge" x1="0" x2="${W}" y1="${H}" y2="${H}" class="plan-fill-edge" />
    </g>
    <g mask="url(#planDoors)">
      <g class="plan-walls">${rooms}</g>
      <rect x="0" y="0" width="${W}" height="${H}" class="plan-outline" />
    </g>
  </svg>`;
}

/** ratio: 0~1 (calc.fillRatio 결과를 그대로 넘긴다) */
export function setPlanFill(root, ratio) {
  const r = Math.max(0, Math.min(1, ratio));
  const h = H * r;
  const fill = root.querySelector("#planFill");
  const edge = root.querySelector("#planFillEdge");
  fill.setAttribute("y", String(H - h));
  fill.setAttribute("height", String(h));
  edge.setAttribute("y1", String(H - h));
  edge.setAttribute("y2", String(H - h));
  edge.style.opacity = r > 0 && r < 1 ? "1" : "0";
}
