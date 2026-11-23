// 완료 기준 브라우저 점검. 실행: node tests/e2e/check.mjs  (Playwright 필요)
// 서버 없이 레포 파일을 직접 서빙하고, /api/subscribe는 가짜 응답으로 대신한다.
import { openBrowser, newPage, ORIGIN } from "./harness.mjs";
import { wealthAt, fillPercent, formatManwon } from "../../js/calc.js";

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); };

const okApi = (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"status":"created"}' });

async function fillAndSubmit(page, v) {
  await page.fill("#inA", String(v.A)); await page.fill("#inP", String(v.P));
  await page.fill("#inRa", String(v.ra)); await page.fill("#inT", String(v.T));
  await page.fill("#inN", v.N == null ? "" : String(v.N));
  await page.click("#submitBtn");
}

/** 보이는 글자의 최소 명암비(WCAG). 배경은 가장 가까운 불투명 배경을 따라 올라간다 */
async function minTextContrast(page) {
  return page.evaluate(() => {
    const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c.length < 4 || c[3] > 0.9) return c;
      }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    let worst = { ratio: 99, text: "" };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!n.textContent.trim() || !el || el.closest("svg, [hidden], .hp, option, script, style")) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const fg = parse(cs.color), bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (ratio < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, text: n.textContent.trim().slice(0, 30) };
    }
    return worst;
  });
}

/** 그래프 SVG 글자(축·목표 라벨)의 명암비 */
async function chartTextContrast(page) {
  return page.evaluate(() => {
    const parse = (c) => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = parse(getComputedStyle(document.getElementById("chartCard")).backgroundColor);
    let worst = 99;
    document.querySelectorAll(".chart-svg text, .plan-label").forEach((t) => {
      const fg = parse(getComputedStyle(t).fill);
      const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
      worst = Math.min(worst, ratio);
    });
    return Math.round(worst * 100) / 100;
  });
}

const browser = await openBrowser();
const sample = { A: 3000, P: 150, ra: 5, T: 20000, N: 5 };

// 1) 360px · 라이트/다크 · 두 A/B 버전: 가로 스크롤, 명암, 고지 문구
for (const colorScheme of ["light", "dark"]) {
  for (const ab of ["plan", "graph"]) {
    const { page, errors } = await newPage(browser, { colorScheme, apiHandler: okApi });
    await page.goto(`${ORIGIN}/sim.html?ab=${ab}`);
    const tag = `${colorScheme}/${ab}`;
    check(`360px 입력 화면 가로 스크롤 없음 (${tag})`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= 360);
    await fillAndSubmit(page, sample);
    await page.locator("#subscribeCard details").evaluate((d) => { d.open = true; });
    await page.locator("#chartCard details").evaluate((d) => { d.open = true; });
    check(`360px 결과 화면 가로 스크롤 없음 (${tag})`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= 360);
    const c = await minTextContrast(page);
    check(`본문 글자 명암비 ≥ 4.5 (${tag})`, c.ratio >= 4.5, `최저 ${c.ratio} "${c.text}"`);
    const cc = await chartTextContrast(page);
    check(`그래프·도면 글자 명암비 ≥ 4.5 (${tag})`, cc >= 4.5, `최저 ${cc}`);
    check(`계산 고지 문구 보임 (${tag})`, await page.isVisible("#disclaimer"));
    check(`A/B: 도면 ${ab === "plan" ? "보임" : "숨김"} (${tag})`, (await page.isVisible("#planCard")) === (ab === "plan"));
    check(`A/B: 그래프는 항상 보임 (${tag})`, await page.isVisible("#chartCard"));
    check(`페이지 오류 없음 (${tag})`, errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// 2) 슬라이더: 모든 시점에서 도면·그래프·숫자·퍼센트 일치
{
  const { page } = await newPage(browser, { apiHandler: okApi });
  await page.goto(`${ORIGIN}/sim.html?ab=plan`);
  await fillAndSubmit(page, sample);
  const max = Number(await page.$eval("#timeSlider", (s) => s.max));
  let bad = [];
  for (let m = 0; m <= max; m++) {
    const got = await page.evaluate((m) => {
      const s = document.getElementById("timeSlider");
      s.value = String(m); s.dispatchEvent(new Event("input"));
      const fill = document.getElementById("planFill");
      const pts = document.querySelector(".line-wealth").getAttribute("d").slice(1).split("L").map((p) => p.split(",").map(Number));
      const dot = document.querySelector(".now-wealth");
      return {
        amount: document.getElementById("tlAmount").textContent,
        tl: document.getElementById("tlPercent").textContent,
        plan: document.getElementById("planPercent").textContent,
        fillH: Number(fill.getAttribute("height")),
        dot: [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))],
        pt: pts[m],
      };
    }, m);
    const W = wealthAt(sample, m);
    const pct = `${fillPercent(W, sample.T)}%`;
    const fillOk = Math.abs(got.fillH / 580 - Math.min(W / sample.T, 1)) < 1e-6;
    const dotOk = Math.abs(got.dot[0] - got.pt[0]) < 0.11 && Math.abs(got.dot[1] - got.pt[1]) < 0.11;
    if (got.amount !== formatManwon(W) || got.tl !== pct || got.plan !== pct || !fillOk || !dotOk) bad.push({ m, got, W });
  }
  check(`슬라이더 0~${max}개월 전 구간에서 도면·그래프·자산·퍼센트 일치`, bad.length === 0, bad.length ? JSON.stringify(bad[0]) : "");
  const tile = await page.textContent("#tile3y");
  const row = await page.$$eval(".chart-table tbody tr", (rs) => rs[3]?.lastElementChild.textContent);
  check("3년 뒤 자산: 요약 타일 = 표 값", tile === row, `${tile} / ${row}`);
  await page.close();
}

// 3) 저장·복원·초기화, 저장소 차단
{
  const { page } = await newPage(browser, { apiHandler: okApi });
  await page.goto(`${ORIGIN}/sim.html`);
  await fillAndSubmit(page, sample);
  await page.waitForTimeout(300);
  const key = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tikklemoa:sim:")));
  check("입력값 저장 키 tikklemoa:sim:v1", key.includes("tikklemoa:sim:v1"));
  await page.reload();
  check("재방문 시 입력값·결과 복원", (await page.inputValue("#inA")) === "3000" && (await page.isVisible("#resultSection")));
  await page.click("#resetBtn");
  await page.reload();
  check("입력 초기화 후 비어 있음", (await page.inputValue("#inA")) === "" && !(await page.isVisible("#resultSection")));
  await page.close();

  const blocked = await newPage(browser, { blockStorage: true, apiHandler: okApi });
  await blocked.page.goto(`${ORIGIN}/sim.html`);
  await fillAndSubmit(blocked.page, sample);
  check("저장소 차단: 안내 표시", await blocked.page.isVisible("#storageNotice"));
  check("저장소 차단: 결과 정상 표시·오류 없음", (await blocked.page.isVisible("#resultSection")) && blocked.errors.length === 0, blocked.errors.join(" | "));
  await blocked.page.close();
}

// 4) 가입 폼
{
  let calls = 0;
  const { page } = await newPage(browser, { apiHandler: (r) => { calls++; return okApi(r); } });
  await page.goto(`${ORIGIN}/sim.html`);
  await fillAndSubmit(page, sample);
  await page.fill("#subEmail", "wrong@"); await page.check("#consentPrivacy"); await page.check("#consentReport");
  await page.click("#subscribeBtn");
  check("가입: 잘못된 이메일 차단", calls === 0 && (await page.textContent("#subEmailErr")).length > 0);
  await page.fill("#subEmail", "me@example.com"); await page.uncheck("#consentReport");
  await page.click("#subscribeBtn");
  check("가입: 동의 없는 제출 차단", calls === 0 && (await page.textContent("#subConsentErr")).length > 0);
  await page.check("#consentReport"); await page.click("#subscribeBtn");
  await page.waitForSelector("#subStatus.ok");
  check("가입: 성공 메시지", calls === 1);
  await page.close();

  const fail = await newPage(browser, { apiHandler: (r) => r.fulfill({ status: 500, body: "{}" }) });
  await fail.page.goto(`${ORIGIN}/sim.html`);
  await fillAndSubmit(fail.page, sample);
  await fail.page.fill("#subEmail", "me@example.com"); await fail.page.check("#consentPrivacy"); await fail.page.check("#consentReport");
  await fail.page.click("#subscribeBtn");
  await fail.page.waitForSelector("#subStatus.fail");
  check("가입: 실패 메시지 + 입력값 유지", (await fail.page.inputValue("#inA")) === "3000");
  await fail.page.close();
}

// 5) 이벤트 8종 (퀴즈 → 시뮬레이터 → 공유 → 가입 → 재방문)
{
  const { page } = await newPage(browser, { apiHandler: okApi });
  const seen = new Map();
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[tikklemoa:event]")) seen.set(t.split(" ")[1], true);
  });
  const leaks = [];
  page.on("console", async (m) => {
    if (!m.text().startsWith("[tikklemoa:event]")) return;
    const ev = await m.args()[2]?.jsonValue().catch(() => null);
    if (ev && ["A", "P", "ra", "T", "N", "email"].some((k) => k in ev)) leaks.push(ev.event);
    if (ev && !("variant" in ev && "ref" in ev && "quiz_type" in ev)) leaks.push(`${ev.event}:공통속성누락`);
  });
  await page.goto(`${ORIGIN}/quiz.html?ref=check`);
  await page.click("#startBtn");
  await page.click("#income-options .opt-btn >> nth=1");
  for (let i = 0; i < 10 && !(await page.isVisible("#s-result")); i++) {
    await page.click("#s-quiz .opt-btn >> nth=0"); await page.click("#nextBtn");
  }
  await page.click("#simBtn");
  await page.waitForURL(/sim\.html/);
  check("퀴즈 CTA → 시뮬레이터, 월 적립액 기본값 채움", (await page.inputValue("#inP")) !== "");
  await page.fill("#inA", "1000"); await page.fill("#inRa", "4");
  await page.click("#submitBtn");
  await page.click("#shareBtn");
  await page.fill("#subEmail", "me@example.com"); await page.check("#consentPrivacy"); await page.check("#consentReport");
  await page.click("#subscribeBtn"); await page.waitForSelector("#subStatus.ok");
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem("tikklemoa:meta:v1"));
    m.firstInputCompleteAt = new Date(Date.now() - 2 * 864e5).toISOString();
    localStorage.setItem("tikklemoa:meta:v1", JSON.stringify(m));
  });
  await page.reload();
  await page.waitForTimeout(300);
  const all = ["quiz_landing_view", "quiz_start", "quiz_complete", "sim_enter", "input_complete", "report_share", "return_visit", "report_subscribe"];
  const missing = all.filter((e) => !seen.has(e));
  check("이벤트 8종 모두 발생", missing.length === 0, missing.length ? `누락: ${missing}` : "");
  check("이벤트에 금액·이메일 없음, 공통 속성 있음", leaks.length === 0, leaks.join(","));
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
