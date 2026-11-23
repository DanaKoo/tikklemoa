// GET /api/cron-report — Vercel Cron이 매일 1회 호출.
// 가입 시점부터 꽉 찬 달이 하나 늘어난 구독자에게만 보내므로, 각자 한 달에 한 번 받는다.
// Resend 무료 한도(하루 100통)를 넘지 않도록 한 번 실행에 MAX_PER_RUN 통까지만 보내고, 나머지는 다음 날 보낸다.
import { listActive, updateSubscriber } from "./_lib/db.js";
import { sendMail } from "./_lib/mail.js";
import { unsubscribeToken } from "./_lib/token.js";
import { env, siteUrl } from "./_lib/env.js";
import { isDue, buildReport, renderEmail } from "./_lib/report.js";

const MAX_PER_RUN = Number(process.env.REPORT_MAX_PER_RUN || 90);

export default async function handler(req, res) {
  // Vercel Cron은 CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 을 붙여 호출한다
  let secret;
  try { secret = env("CRON_SECRET"); } catch { return res.status(503).json({ error: "not_configured" }); }
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorized" });

  const now = new Date();
  const result = { checked: 0, due: 0, sent: 0, failed: 0, deferred: 0 };
  try {
    const subs = await listActive();
    result.checked = subs.length;
    const due = subs.filter((s) => isDue(s, now));
    result.due = due.length;
    for (const sub of due) {
      if (result.sent + result.failed >= MAX_PER_RUN) { result.deferred++; continue; }
      const report = buildReport(sub, now);
      const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?id=${encodeURIComponent(sub.id)}&t=${unsubscribeToken(sub.id)}`;
      const mail = renderEmail(report, { siteUrl: siteUrl(), unsubscribeUrl });
      try {
        await sendMail({ to: sub.email, ...mail, unsubscribeUrl });
        await updateSubscriber(sub.id, { last_report_month: report.month, last_sent_at: now.toISOString() });
        result.sent++;
      } catch (e) {
        result.failed++;
        console.error("report send failed", sub.id, e.message);
      }
    }
    return res.status(200).json(result);
  } catch (e) {
    if (e.code === "not_configured") return res.status(503).json({ error: "not_configured" });
    console.error("cron-report failed", e.message);
    return res.status(500).json({ error: "server", ...result });
  }
}
