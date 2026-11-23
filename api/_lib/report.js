// 월 1회 리포트 내용: 가입 시점 스냅샷 기준으로 경과 개월 수만큼 진행했을 때의 예상 자산과 채움 비율
import {
  wealthAt, fillPercent, monthsToGoal, formatManwon, formatDuration,
} from "../../js/calc.js";

/** from → to 사이의 꽉 찬 달 수 (1월 31일 → 2월 28일은 0개월) */
export function monthsElapsed(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/** 이번 실행에서 리포트를 보낼 대상인지 */
export function isDue(sub, now) {
  if (sub.unsubscribed_at) return false;
  const k = monthsElapsed(sub.snapshot_at, now);
  return k >= 1 && k > (sub.last_report_month || 0);
}

export function buildReport(sub, now) {
  const s = sub.snapshot;
  const k = monthsElapsed(sub.snapshot_at, now);
  const W = wealthAt(s, k);
  const percent = fillPercent(W, s.T);
  const achieve = monthsToGoal(s);
  let goalLine;
  if (achieve === null) goalLine = "가입 때 입력한 속도로는 50년 안에 목표 달성이 어려워요.";
  else if (achieve <= k) goalLine = "가입 때 입력한 속도라면 목표 금액에 이미 도달했을 거예요.";
  else goalLine = `가입 때 입력한 속도라면 목표까지 ${formatDuration(achieve - k)} 남았어요.`;
  return {
    month: k,
    wealth: W,
    percent,
    subject: `[티끌모아] 가입 ${k}개월째, 59㎡의 ${percent}%를 채웠을 거예요`,
    lines: [
      `가입 ${k}개월째 예상 자산: ${formatManwon(W)}`,
      `목표 ${formatManwon(s.T)} 대비 ${percent}% (59㎡ 도면 채움)`,
      goalLine,
    ],
  };
}

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderEmail(report, { siteUrl, unsubscribeUrl }) {
  const disclaimer = "가입 시점에 입력한 값 기준의 계산이며 예측이나 투자 권유가 아닙니다. 실제 자산과 다를 수 있어요.";
  const text = [
    ...report.lines,
    "",
    `지금 값으로 다시 계산해 보기: ${siteUrl}/sim.html?ref=report`,
    "",
    disclaimer,
    `수신거부: ${unsubscribeUrl}`,
  ].join("\n");

  const bar = Math.max(0, Math.min(100, report.percent));
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f4f4f6;font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#141414">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px">
    <div style="font-weight:800;font-size:18px;margin-bottom:16px">티끌모아</div>
    <div style="background:#fff;border-radius:16px;padding:20px">
      <div style="font-size:14px;color:#55555e">가입 ${report.month}개월째 예상 자산</div>
      <div style="font-size:26px;font-weight:800;margin:4px 0 12px">${esc(report.lines[0].split(": ")[1])}</div>
      <div style="background:#e8eefc;border-radius:8px;height:14px;overflow:hidden"><div style="background:#2f66e3;height:14px;width:${bar}%"></div></div>
      <div style="font-size:14px;margin-top:8px">${esc(report.lines[1])}</div>
      <div style="font-size:14px;margin-top:4px">${esc(report.lines[2])}</div>
      <a href="${esc(siteUrl)}/sim.html?ref=report" style="display:block;text-align:center;background:#2f66e3;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:12px;margin-top:18px">지금 값으로 다시 계산해 보기</a>
    </div>
    <p style="font-size:12px;color:#74747d;line-height:1.6;margin-top:16px">${esc(disclaimer)}<br>
    이 메일은 티끌모아 월 1회 리포트 수신에 동의하신 분께 보내 드려요.<br>
    <a href="${esc(unsubscribeUrl)}" style="color:#55555e">수신거부</a> · <a href="${esc(siteUrl)}/privacy.html" style="color:#55555e">개인정보처리방침</a></p>
  </div></body></html>`;
  return { subject: report.subject, text, html };
}
