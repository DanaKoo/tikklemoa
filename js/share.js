// 공유: 시스템 공유(지원 시) → 링크 복사. 링크에는 입력값 없이 유입 파라미터만 붙인다.
import { KAKAO_JS_KEY } from "./config.js";

export function shareUrl(origin = window.location.origin) {
  return `${origin}/quiz.html?ref=share`;
}

const SHARE_TEXT = "티끌모아로 내 집 59㎡를 언제 다 채울 수 있는지 계산해 봤어요. 나도 해 보기";

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 아래 대체 방식으로 */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * 공유를 실행하고 결과를 돌려준다.
 * { done: true, method: "system" | "copy" } 또는 { done: false, reason }
 */
export async function share() {
  const url = shareUrl();

  // TODO(카카오): 앱 키와 도메인 등록이 준비되면 config.js에 KAKAO_JS_KEY를 넣고
  // 여기서 Kakao.Share.sendDefault 를 호출한다. 그 전까지는 아래 경로만 쓴다.
  if (KAKAO_JS_KEY && window.Kakao) {
    /* 연결 예정 */
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: "티끌모아", text: SHARE_TEXT, url });
      return { done: true, method: "system" };
    } catch (e) {
      if (e && e.name === "AbortError") return { done: false, reason: "cancelled" };
      // 그 밖의 오류는 링크 복사로 대체
    }
  }
  const ok = await copyText(url);
  return ok ? { done: true, method: "copy" } : { done: false, reason: "copy_failed", url };
}
