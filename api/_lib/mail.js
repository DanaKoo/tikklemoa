// Resend로 메일 발송 (https://resend.com/docs/api-reference/emails/send-email)
import { env } from "./env.js";

export async function sendMail({ to, subject, html, text, unsubscribeUrl }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("MAIL_FROM"),
      to: [to],
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const e = new Error(`mail ${res.status}: ${body.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}
