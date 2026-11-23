// Supabase(PostgREST) 접근. SDK 없이 fetch만 쓴다.
import { env } from "./env.js";

function base() {
  return `${env("SUPABASE_URL").replace(/\/+$/, "")}/rest/v1/subscribers`;
}

function headers(extra = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = new Error(`db ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return body;
}

export async function findByEmail(email) {
  const rows = await call(`${base()}?email=eq.${encodeURIComponent(email)}&select=id,unsubscribed_at`, { headers: headers() });
  return rows[0] || null;
}

export async function insertSubscriber(row) {
  const rows = await call(base(), { method: "POST", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(row) });
  return rows[0];
}

export async function updateSubscriber(id, patch) {
  const rows = await call(`${base()}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows[0] || null;
}

export async function listActive(limit = 1000) {
  return call(`${base()}?unsubscribed_at=is.null&select=*&order=snapshot_at.asc&limit=${limit}`, { headers: headers() });
}
