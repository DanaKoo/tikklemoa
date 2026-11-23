// 월 1회 리포트 가입 카드
const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MESSAGES = {
  created: (email) => `가입했어요! 다음 달부터 리포트를 보내 드릴게요. (받는 주소: ${email})`,
  updated: () => "이미 가입된 이메일이에요. 리포트 기준 입력값을 지금 값으로 바꿨어요.",
  resubscribed: (email) => `다시 가입했어요! 다음 달부터 리포트를 보내 드릴게요. (받는 주소: ${email})`,
  invalid_email: "이메일 형식을 확인해 주세요.",
  consent_required: "필수 항목에 모두 동의해야 가입할 수 있어요.",
  invalid_snapshot: "입력값을 먼저 확인해 주세요.",
  fail: "가입하지 못했어요. 잠시 뒤 다시 시도해 주세요. 입력값은 이 브라우저에 그대로 남아 있어요.",
};

export function initSubscribe({ getValues, onSuccess }) {
  const form = $("subscribeForm");
  const btn = $("subscribeBtn");
  const status = $("subStatus");

  const setStatus = (kind, msg) => {
    status.hidden = !msg;
    status.className = `sub-status ${kind}`;
    status.textContent = msg || "";
  };
  const setEmailErr = (msg) => {
    $("subEmailErr").textContent = msg || "";
    $("subEmail").setAttribute("aria-invalid", msg ? "true" : "false");
  };

  $("subEmail").addEventListener("input", () => setEmailErr(""));
  ["consentPrivacy", "consentReport"].forEach((id) =>
    $(id).addEventListener("change", () => { $("subConsentErr").textContent = ""; }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");
    const email = $("subEmail").value.trim().toLowerCase();
    let bad = false;
    if (!EMAIL_RE.test(email) || email.length > 254) { setEmailErr(MESSAGES.invalid_email); bad = true; }
    if (!$("consentPrivacy").checked || !$("consentReport").checked) {
      $("subConsentErr").textContent = MESSAGES.consent_required;
      bad = true;
    }
    const values = getValues();
    if (!values) { setStatus("fail", MESSAGES.invalid_snapshot); bad = true; }
    if (bad) {
      if ($("subEmailErr").textContent) $("subEmail").focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = "가입하는 중…";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consentPrivacy: true,
          consentReport: true,
          snapshot: { A: values.A, P: values.P, ra: values.ra, T: values.T, N: values.N },
          website: $("subWebsite").value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("ok", MESSAGES[data.status] ? MESSAGES[data.status](email) : MESSAGES.created(email));
        onSuccess && onSuccess(data.status);
      } else if (data.error === "invalid_email") {
        setEmailErr(MESSAGES.invalid_email);
      } else if (data.error === "consent_required") {
        $("subConsentErr").textContent = MESSAGES.consent_required;
      } else if (data.error === "invalid_snapshot") {
        setStatus("fail", MESSAGES.invalid_snapshot);
      } else {
        setStatus("fail", MESSAGES.fail);
      }
    } catch {
      setStatus("fail", MESSAGES.fail);
    } finally {
      btn.disabled = false;
      btn.textContent = "리포트 받기";
    }
  });
}
