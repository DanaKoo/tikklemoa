// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wealthAt, principalAt, monthsToGoal, requiredMonthly, requiredMonthlyDisplay,
  fillPercent, fillRatio, formatManwon, formatDuration, validateInputs, horizonMonths,
} from "../js/calc.js";

// ── 지시서 테스트 케이스 6건 ──────────────────────────────
test("#1 r=0, A=1000, P=100, n=12 → W=2200", () => {
  assert.equal(wealthAt({ A: 1000, P: 100, ra: 0 }, 12), 2200);
});

test("#2 r=0, A=1000, P=100, T=3000 → 달성 20개월", () => {
  assert.equal(monthsToGoal({ A: 1000, P: 100, ra: 0, T: 3000 }), 20);
});

test("#3 r=0, A=1000, T=3000, N=2 → P*=83.33, 표시 84", () => {
  const v = requiredMonthly({ A: 1000, ra: 0, T: 3000 }, 2);
  assert.ok(Math.abs(v - 83.333333) < 1e-4, `P*=${v}`);
  assert.equal(requiredMonthlyDisplay({ A: 1000, ra: 0, T: 3000 }, 2), 84);
});

test("#4 A ≥ T → 달성 0개월, 도면 100%", () => {
  const inp = { A: 5000, P: 0, ra: 0, T: 3000 };
  assert.equal(monthsToGoal(inp), 0);
  assert.equal(fillPercent(wealthAt(inp, 0), inp.T), 100);
  assert.equal(fillPercent(3000, 3000), 100);
});

test("#5 P=0, r=0, A<T → 달성 불가(null)", () => {
  assert.equal(monthsToGoal({ A: 1000, P: 0, ra: 0, T: 3000 }), null);
});

test("#6 A=1000, P=50, r_a=5, n=12 → W≈1665.1", () => {
  const w = wealthAt({ A: 1000, P: 50, ra: 5 }, 12);
  // 스프레드시트 교차 확인: =FV(5%/12, 12, -50, -1000) = 1665.1047
  assert.ok(Math.abs(w - 1665.1047) < 0.001, `W=${w}`);
});

// ── 보조 규칙 ─────────────────────────────────────────
test("원금 누적 = A + P·n", () => {
  assert.equal(principalAt({ A: 1000, P: 50 }, 12), 1600);
});

test("필요 월 적립액: 이미 충분하면 0", () => {
  assert.equal(requiredMonthly({ A: 5000, ra: 5, T: 3000 }, 3), 0);
  assert.equal(requiredMonthlyDisplay({ A: 5000, ra: 5, T: 3000 }, 3), 0);
});

test("필요 월 적립액(r>0)으로 적립하면 N년 뒤 목표 이상", () => {
  const inp = { A: 1000, ra: 5, T: 10000 };
  const p = requiredMonthlyDisplay(inp, 5);
  assert.ok(wealthAt({ ...inp, P: p }, 60) >= inp.T);
  assert.ok(wealthAt({ ...inp, P: p - 1 }, 60) < inp.T);
});

test("채움 퍼센트는 내림, W<T 이면 100이 나오지 않는다", () => {
  assert.equal(fillPercent(2999.99, 3000), 99);
  assert.equal(fillPercent(1500, 3000), 50);
  assert.equal(fillPercent(899.999, 3000), 29);
  assert.equal(fillRatio(6000, 3000), 1);
});

test("달성 시점은 최소 n: n-1개월에는 미달", () => {
  const inp = { A: 1000, P: 50, ra: 5, T: 3000 };
  const n = monthsToGoal(inp);
  assert.ok(wealthAt(inp, n) >= inp.T);
  assert.ok(wealthAt(inp, n - 1) < inp.T);
});

test("금액 표시 형식", () => {
  assert.equal(formatManwon(12000), "1억 2,000만 원");
  assert.equal(formatManwon(10000), "1억 원");
  assert.equal(formatManwon(2000), "2,000만 원");
  assert.equal(formatManwon(1665.11), "1,665만 원");
  assert.equal(formatManwon(123456), "12억 3,456만 원");
  assert.equal(formatManwon(0), "0원");
});

test("기간 표시 형식", () => {
  assert.equal(formatDuration(20), "1년 8개월");
  assert.equal(formatDuration(24), "2년");
  assert.equal(formatDuration(8), "8개월");
  assert.equal(formatDuration(0), "지금");
});

test("입력 검증", () => {
  const ok = validateInputs({ A: "1,000", P: "50", ra: "5", T: "3000", N: "" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.values, { A: 1000, P: 50, ra: 5, T: 3000, N: null });

  const bad = validateInputs({ A: "-1", P: "", ra: "31", T: "0", N: "0" });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["A", "N", "P", "T", "ra"]);

  assert.equal(validateInputs({ A: "0", P: "0", ra: "0", T: "1", N: "30" }).ok, true);
  assert.equal(validateInputs({ A: "0", P: "0", ra: "30", T: "1", N: "31" }).ok, false);
  assert.equal(validateInputs({ A: "abc", P: "0", ra: "0", T: "1" }).errors.A !== undefined, true);
});

test("슬라이더 범위: 달성 시점(최소 1년, 최대 30년)", () => {
  assert.equal(horizonMonths(20), 20);
  assert.equal(horizonMonths(0), 12);
  assert.equal(horizonMonths(500), 360);
  assert.equal(horizonMonths(null), 360);
});
