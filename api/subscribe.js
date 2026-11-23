// POST /api/subscribe — 월 1회 리포트 가입. 입력값이 서버로 오는 유일한 지점.
// body: { email, consentPrivacy: true, consentReport: true, snapshot: {A,P,ra,T,N}, website: "" (봇 차단용 빈 칸) }
import { validateInputs } from "../js/calc.js";
import { findByEmail, insertSubscriber, updateSubscriber } from "./_lib/db.js";
import { CONSENT_VERSION } from "./_lib/env.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** 요청 본문 검증. 문제가 있으면 { error }, 괜찮으면 { email, snapshot } */
export function parseBody(body) {
  if (!body || typeof body !== "object") return { error: "bad_request" };
  if (body.website) return { error: "bad_request" }; // 허니팟
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return { error: "invalid_email" };
  if (body.consentPrivacy !== true || body.consentReport !== true) return { error: "consent_required" };
  const s = body.snapshot || {};
  const v = validateInputs({ A: s.A, P: s.P, ra: s.ra, T: s.T, N: s.N ?? "" });
  if (!v.ok) return { error: "invalid_snapshot" };
  return { email, snapshot: v.values };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const parsed = parseBody(body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const now = new Date().toISOString();
  try {
    const existing = await findByEmail(parsed.email);
    if (existing) {
      // 같은 이메일 재가입: 스냅샷만 갱신(경과 개월도 새 스냅샷 기준으로 다시 센다).
      // 수신거부했던 사람이 다시 가입하면 새로 동의한 것이므로 동의 시각을 새로 기록하고 재활성화한다.
      const patch = { snapshot: parsed.snapshot, snapshot_at: now, last_report_month: 0 };
      if (existing.unsubscribed_at) {
        Object.assign(patch, { unsubscribed_at: null, consent_privacy_at: now, consent_report_at: now, consent_version: CONSENT_VERSION });
      }
      await updateSubscriber(existing.id, patch);
      return res.status(200).json({ ok: true, status: existing.unsubscribed_at ? "resubscribed" : "updated" });
    }
    try {
      await insertSubscriber({
        email: parsed.email,
        consent_privacy_at: now,
        consent_report_at: now,
        consent_version: CONSENT_VERSION,
        snapshot: parsed.snapshot,
        snapshot_at: now,
      });
    } catch (e) {
      if (e.status === 409) { // 동시에 두 번 눌린 경우
        const again = await findByEmail(parsed.email);
        if (again) await updateSubscriber(again.id, { snapshot: parsed.snapshot, snapshot_at: now, last_report_month: 0 });
        return res.status(200).json({ ok: true, status: "updated" });
      }
      throw e;
    }
    return res.status(200).json({ ok: true, status: "created" });
  } catch (e) {
    if (e.code === "not_configured") return res.status(503).json({ error: "not_configured" });
    console.error("subscribe failed", e.message); // 이메일 등 개인정보는 로그에 남기지 않는다
    return res.status(500).json({ error: "server" });
  }
}
