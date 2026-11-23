// 수신거부 링크용 서명 토큰: HMAC-SHA256(id, UNSUBSCRIBE_SECRET)
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

export function unsubscribeToken(id, secret = env("UNSUBSCRIBE_SECRET")) {
  return createHmac("sha256", secret).update(String(id)).digest("base64url");
}

export function verifyUnsubscribeToken(id, token, secret = env("UNSUBSCRIBE_SECRET")) {
  if (!id || !token) return false;
  const a = Buffer.from(unsubscribeToken(id, secret));
  const b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}
