// 티끌모아 자산 시뮬레이터 계산 모듈 (순수 함수만, DOM 접근 없음)
// 모든 금액 단위는 "만 원". 월말 적립, 월복리.
//   r    = r_a / 12 / 100
//   W(n) = A(1+r)^n + P((1+r)^n - 1) / r      (r = 0 이면 A + P·n)

export const MAX_MONTHS = 600; // 50년
export const RATE_MIN = 0;
export const RATE_MAX = 30;
export const PERIOD_MIN = 1;
export const PERIOD_MAX = 30;

const EPS = 1e-9;

export function monthlyRate(annualRatePct) {
  return annualRatePct / 12 / 100;
}

/** n개월 뒤 수익 포함 자산 W(n) */
export function wealthAt({ A, P, ra }, n) {
  const r = monthlyRate(ra);
  if (r === 0) return A + P * n;
  const g = (1 + r) ** n;
  return A * g + P * (g - 1) / r;
}

/** n개월 뒤 원금 누적(수익 제외) */
export function principalAt({ A, P }, n) {
  return A + P * n;
}

/**
 * W(n) ≥ T 인 가장 작은 n(개월). A ≥ T 이면 0.
 * maxMonths 안에 달성하지 못하면 null.
 */
export function monthsToGoal({ A, P, ra, T }, maxMonths = MAX_MONTHS) {
  if (A >= T) return 0;
  for (let n = 1; n <= maxMonths; n++) {
    if (wealthAt({ A, P, ra }, n) >= T - EPS) return n;
  }
  return null;
}

/** N년 안에 T를 모으기 위한 월 적립액 P* (만 원, 소수 포함) */
export function requiredMonthly({ A, ra, T }, N) {
  const n = 12 * N;
  const r = monthlyRate(ra);
  if (r === 0) return Math.max(0, (T - A) / n);
  const g = (1 + r) ** n;
  return Math.max(0, (T - A * g) * r / (g - 1));
}

/** 화면 표시용 필요 월 적립액: 정수 만 원으로 올림 */
export function requiredMonthlyDisplay(inputs, N) {
  const v = requiredMonthly(inputs, N);
  // 부동소수 오차(예: 100.00000000001)로 1만 원이 더 올라가는 것을 막는다
  return Math.max(0, Math.ceil(v - EPS)) + 0; // -0 방지
}

/** 도면 채움 비율 min(W/T, 1) */
export function fillRatio(W, T) {
  return Math.min(W / T, 1);
}

/** 채움 퍼센트(내림). W ≥ T 일 때만 100. */
export function fillPercent(W, T) {
  if (W >= T) return 100;
  const p = Math.floor(fillRatio(W, T) * 100 + EPS);
  return Math.min(Math.max(p, 0), 99);
}

/** "1억 2,000만 원" 형식. v: 만 원 단위 */
export function formatManwon(v) {
  const neg = v < 0;
  const total = Math.round(Math.abs(v));
  if (total === 0) return "0원";
  const eok = Math.floor(total / 10000);
  const man = total % 10000;
  const parts = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return `${neg ? "-" : ""}${parts.join(" ")} 원`;
}

/** 개월 수 → "1년 8개월", "8개월", "3년" */
export function formatDuration(months) {
  if (months === 0) return "지금";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y && m) return `${y}년 ${m}개월`;
  if (y) return `${y}년`;
  return `${m}개월`;
}

/** 오늘 기준 n개월 뒤 "2028년 7월" */
export function formatTargetDate(months, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/**
 * 입력 문자열 검증. raw: { A, P, ra, T, N } (문자열 또는 숫자)
 * 반환: { ok, values, errors } — errors[field] = 사용자에게 보여줄 문장
 */
export function validateInputs(raw) {
  const errors = {};
  const values = {};
  const num = (s) => {
    if (s === undefined || s === null) return NaN;
    const t = String(s).replace(/,/g, "").trim();
    if (t === "") return NaN;
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  };
  const isBlank = (s) => s === undefined || s === null || String(s).trim() === "";

  const check = (key, label, rule) => {
    if (isBlank(raw[key])) { errors[key] = `${label}을 입력해 주세요.`; return; }
    const v = num(raw[key]);
    if (Number.isNaN(v)) { errors[key] = `${label}은 숫자로만 입력해 주세요.`; return; }
    const msg = rule(v);
    if (msg) errors[key] = msg; else values[key] = v;
  };

  check("A", "현재 자산", (v) => (v < 0 ? "현재 자산은 0 이상이어야 해요." : null));
  check("P", "월 적립액", (v) => (v < 0 ? "월 적립액은 0 이상이어야 해요." : null));
  check("ra", "연 수익률", (v) =>
    v < RATE_MIN || v > RATE_MAX ? `연 수익률은 ${RATE_MIN}%에서 ${RATE_MAX}% 사이로 입력해 주세요.` : null);
  check("T", "목표 금액", (v) => (v <= 0 ? "목표 금액은 0보다 커야 해요." : null));

  if (isBlank(raw.N)) {
    values.N = null;
  } else {
    const v = num(raw.N);
    if (Number.isNaN(v) || !Number.isInteger(v)) errors.N = "목표 기간은 1에서 30 사이의 정수(년)로 입력해 주세요.";
    else if (v < PERIOD_MIN || v > PERIOD_MAX) errors.N = `목표 기간은 ${PERIOD_MIN}년에서 ${PERIOD_MAX}년 사이로 입력하거나 비워 두세요.`;
    else values.N = v;
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/** 결과 화면에 필요한 값을 한 번에 계산 */
export function simulate(inputs) {
  const { A, P, ra, T, N } = inputs;
  const achieveMonths = monthsToGoal({ A, P, ra, T });
  const in3y = wealthAt({ A, P, ra }, 36);
  const required = N ? requiredMonthlyDisplay({ A, ra, T }, N) : null;
  return { achieveMonths, in3y, required };
}

/** 그래프/슬라이더 범위: 0 ~ 달성 시점(최대 30년). 이미 달성이면 1년 */
export function horizonMonths(achieveMonths) {
  if (achieveMonths === null) return 360;
  return Math.min(Math.max(achieveMonths, 12), 360);
}
