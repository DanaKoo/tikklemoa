// /api/unsubscribe?id=&t=
// GET  → 확인 화면(메일 보안 스캐너가 링크를 미리 열어도 수신거부되지 않도록 버튼을 한 번 더 누르게 한다)
// POST → 수신거부 처리. 메일 앱의 원클릭 수신거부(List-Unsubscribe-Post)도 이 경로로 온다.
import { verifyUnsubscribeToken } from "./_lib/token.js";
import { updateSubscriber } from "./_lib/db.js";
import { siteUrl } from "./_lib/env.js";

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(title, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)}</title>
<style>body{margin:0;font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;color:#141414}
@media (prefers-color-scheme:dark){body{background:#121214;color:#f0efec}.c{background:#1c1c1f!important}}
.c{max-width:420px;margin:48px auto;padding:24px 20px;background:#fff;border-radius:16px}
button{font:inherit;font-weight:700;width:100%;padding:13px;border-radius:12px;border:0;background:#2f66e3;color:#fff;cursor:pointer}
a{color:inherit}</style></head><body><div class="c">${body}</div></body></html>`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://local");
  const id = url.searchParams.get("id") || (req.body && req.body.id);
  const t = url.searchParams.get("t") || (req.body && req.body.t);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  let valid = false;
  try { valid = verifyUnsubscribeToken(id, t); } catch { valid = false; }
  if (!valid) {
    return res.status(400).send(page("링크를 확인해 주세요", "<h1>링크가 올바르지 않아요</h1><p>메일에 있는 수신거부 링크를 다시 눌러 주세요.</p>"));
  }

  if (req.method === "GET") {
    return res.status(200).send(page("수신거부", `<h1>월 1회 리포트를 그만 받을까요?</h1>
      <p>수신거부하면 더 이상 리포트를 보내지 않아요.</p>
      <form method="post" action="/api/unsubscribe?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}"><button type="submit">수신거부하기</button></form>`));
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send(page("지원하지 않는 요청", "<p>지원하지 않는 요청이에요.</p>"));
  }

  try {
    await updateSubscriber(id, { unsubscribed_at: new Date().toISOString() });
    return res.status(200).send(page("수신거부 완료", `<h1>수신거부했어요</h1><p>더 이상 리포트를 보내지 않아요. 다시 받고 싶으면 시뮬레이터에서 다시 가입하면 돼요.</p><p><a href="${esc(siteUrl())}/sim.html">시뮬레이터로 가기</a></p>`));
  } catch (e) {
    console.error("unsubscribe failed", e.message);
    return res.status(500).send(page("잠시 뒤 다시 시도해 주세요", "<h1>처리하지 못했어요</h1><p>잠시 뒤 다시 시도해 주세요.</p>"));
  }
}
