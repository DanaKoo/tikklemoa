// 가입·발송·수신거부 API 테스트. 외부 서비스(Supabase, Resend)는 가짜 fetch로 대신한다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.RESEND_API_KEY = "resend-key";
process.env.MAIL_FROM = "티끌모아 <report@example.com>";
process.env.UNSUBSCRIBE_SECRET = "unsub-secret";
process.env.CRON_SECRET = "cron-secret";
process.env.SITE_URL = "https://tikklemoa.test";

const { default: subscribe, parseBody } = await import("../api/subscribe.js");
const { default: cron } = await import("../api/cron-report.js");
const { default: unsubscribe } = await import("../api/unsubscribe.js");
const { monthsElapsed, isDue, buildReport } = await import("../api/_lib/report.js");
const { unsubscribeToken, verifyUnsubscribeToken } = await import("../api/_lib/token.js");

// ── 가짜 DB + 메일 ────────────────────────────────
let rows, mails, nextId;
beforeEach(() => { rows = []; mails = []; nextId = 1; });

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (u.host === "api.resend.com") {
    mails.push(JSON.parse(init.body));
    return json(200, { id: "mail" });
  }
  assert.equal(init.headers.apikey, "service-key");
  const method = init.method || "GET";
  const eq = (k) => (u.searchParams.get(k) || "").replace(/^eq\./, "");
  if (method === "GET" && u.searchParams.has("email")) {
    return json(200, rows.filter((r) => r.email === decodeURIComponent(eq("email"))));
  }
  if (method === "GET") return json(200, rows.filter((r) => !r.unsubscribed_at));
  if (method === "POST") {
    const row = { id: `id-${nextId++}`, last_report_month: 0, unsubscribed_at: null, ...JSON.parse(init.body) };
    if (rows.some((r) => r.email === row.email)) return json(409, { message: "duplicate" });
    rows.push(row);
    return json(201, [row]);
  }
  if (method === "PATCH") {
    const r = rows.find((x) => x.id === eq("id"));
    if (!r) return json(200, []);
    Object.assign(r, JSON.parse(init.body));
    return json(200, [r]);
  }
  return json(500, {});
};

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const snapshot = { A: 1000, P: 50, ra: 5, T: 3000, N: null };
const good = { email: "Me@Example.com ", consentPrivacy: true, consentReport: true, snapshot };

// ── 가입 ─────────────────────────────────────────
test("가입: 잘못된 이메일·동의 누락·이상한 입력값을 막는다", () => {
  assert.equal(parseBody({ ...good, email: "not-an-email" }).error, "invalid_email");
  assert.equal(parseBody({ ...good, consentReport: false }).error, "consent_required");
  assert.equal(parseBody({ ...good, consentPrivacy: undefined }).error, "consent_required");
  assert.equal(parseBody({ ...good, snapshot: { ...snapshot, ra: 99 } }).error, "invalid_snapshot");
  assert.equal(parseBody({ ...good, website: "spam" }).error, "bad_request");
  assert.equal(parseBody(good).email, "me@example.com");
});

test("가입: 새 이메일은 이메일·동의 시각·스냅샷을 저장한다", async () => {
  const res = fakeRes();
  await subscribe({ method: "POST", body: good }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, status: "created" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "me@example.com");
  assert.deepEqual(rows[0].snapshot, snapshot);
  assert.ok(rows[0].consent_privacy_at && rows[0].consent_report_at && rows[0].snapshot_at);
});

test("가입: 같은 이메일 재가입은 스냅샷만 갱신한다", async () => {
  await subscribe({ method: "POST", body: good }, fakeRes());
  const consentAt = rows[0].consent_privacy_at;
  rows[0].last_report_month = 3;
  const res = fakeRes();
  await subscribe({ method: "POST", body: { ...good, snapshot: { ...snapshot, P: 80 } } }, res);
  assert.equal(res.body.status, "updated");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].snapshot.P, 80);
  assert.equal(rows[0].last_report_month, 0);
  assert.equal(rows[0].consent_privacy_at, consentAt);
});

test("가입: GET은 405, 잘못된 본문은 400", async () => {
  const r1 = fakeRes(); await subscribe({ method: "GET" }, r1); assert.equal(r1.statusCode, 405);
  const r2 = fakeRes(); await subscribe({ method: "POST", body: "{" }, r2); assert.equal(r2.statusCode, 400);
});

// ── 발송 ─────────────────────────────────────────
test("경과 개월: 꽉 찬 달만 센다", () => {
  assert.equal(monthsElapsed("2026-01-31T00:00:00Z", "2026-02-28T00:00:00Z"), 0);
  assert.equal(monthsElapsed("2026-01-15T00:00:00Z", "2026-02-15T00:00:00Z"), 1);
  assert.equal(monthsElapsed("2026-01-15T00:00:00Z", "2027-01-14T00:00:00Z"), 11);
});

test("리포트 대상: 새 달이 찼고 아직 안 보낸 구독자만", () => {
  const now = new Date("2026-04-20T00:00:00Z");
  const base = { snapshot_at: "2026-01-20T00:00:00Z", last_report_month: 2, unsubscribed_at: null };
  assert.equal(isDue(base, now), true);
  assert.equal(isDue({ ...base, last_report_month: 3 }, now), false);
  assert.equal(isDue({ ...base, unsubscribed_at: "2026-03-01T00:00:00Z" }, now), false);
  assert.equal(isDue({ ...base, snapshot_at: "2026-04-01T00:00:00Z", last_report_month: 0 }, now), false);
});

test("리포트 내용: 스냅샷 기준 경과 개월만큼의 예상 자산과 채움 비율", () => {
  const r = buildReport({ snapshot, snapshot_at: "2025-11-23T00:00:00Z" }, new Date("2026-11-23T00:00:00Z"));
  assert.equal(r.month, 12);
  assert.ok(Math.abs(r.wealth - 1665.1047) < 0.001);
  assert.equal(r.percent, 55); // 1665.1 / 3000 = 55.5% → 내림
  assert.match(r.subject, /12개월째/);
});

test("크론: 비밀값 없이 호출하면 401", async () => {
  const res = fakeRes();
  await cron({ headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test("크론: 대상에게만 보내고, 모든 메일에 수신거부 링크가 있으며, 다시 실행해도 중복 발송하지 않는다", async () => {
  const twoMonthsAgo = new Date(Date.now() - 62 * 864e5).toISOString();
  rows.push(
    { id: "a", email: "a@x.com", snapshot, snapshot_at: twoMonthsAgo, last_report_month: 0, unsubscribed_at: null },
    { id: "b", email: "b@x.com", snapshot, snapshot_at: new Date().toISOString(), last_report_month: 0, unsubscribed_at: null },
    { id: "c", email: "c@x.com", snapshot, snapshot_at: twoMonthsAgo, last_report_month: 0, unsubscribed_at: "2026-01-01T00:00:00Z" },
  );
  const res = fakeRes();
  await cron({ headers: { authorization: "Bearer cron-secret" } }, res);
  assert.equal(res.body.sent, 1);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, ["a@x.com"]);
  assert.match(mails[0].html, /\/api\/unsubscribe\?id=a&amp;t=/);
  assert.match(mails[0].text, /수신거부: https:\/\/tikklemoa\.test\/api\/unsubscribe\?id=a&t=/);
  assert.match(mails[0].headers["List-Unsubscribe"], /unsubscribe/);
  assert.match(mails[0].html, /예측이나 투자 권유가 아닙니다/);

  const again = fakeRes();
  await cron({ headers: { authorization: "Bearer cron-secret" } }, again);
  assert.equal(again.body.sent, 0);
  assert.equal(mails.length, 1);
});

// ── 수신거부 ──────────────────────────────────────
test("수신거부: 토큰 검증, GET은 확인 화면, POST는 처리", async () => {
  rows.push({ id: "a", email: "a@x.com", snapshot, unsubscribed_at: null });
  const t = unsubscribeToken("a");
  assert.equal(verifyUnsubscribeToken("a", t), true);
  assert.equal(verifyUnsubscribeToken("b", t), false);

  const bad = fakeRes();
  await unsubscribe({ method: "GET", url: "/api/unsubscribe?id=a&t=wrong" }, bad);
  assert.equal(bad.statusCode, 400);

  const get = fakeRes();
  await unsubscribe({ method: "GET", url: `/api/unsubscribe?id=a&t=${t}` }, get);
  assert.equal(get.statusCode, 200);
  assert.equal(rows[0].unsubscribed_at, null); // GET만으로는 수신거부하지 않는다

  const post = fakeRes();
  await unsubscribe({ method: "POST", url: `/api/unsubscribe?id=a&t=${t}` }, post);
  assert.equal(post.statusCode, 200);
  assert.ok(rows[0].unsubscribed_at);
});
