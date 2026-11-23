// 서버 환경변수. 값은 Vercel 프로젝트 설정에만 두고 레포에는 커밋하지 않는다(.env.example 참고).
export function env(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && !v) {
    const e = new Error(`missing env ${name}`);
    e.code = "not_configured";
    throw e;
  }
  return v;
}

export function siteUrl() {
  return (process.env.SITE_URL || "https://tikklemoa.vercel.app").replace(/\/+$/, "");
}

export const CONSENT_VERSION = "2026-11-23-draft";
