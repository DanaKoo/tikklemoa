# 월 1회 리포트 백엔드 설정

구성: **Supabase**(DB) + **Vercel Functions/Cron**(API·스케줄러) + **Resend**(메일). 모두 무료 플랜으로 시작할 수 있습니다.

| 경로 | 역할 |
| --- | --- |
| `POST /api/subscribe` | 이메일·동의·입력값 스냅샷 저장. 같은 이메일은 스냅샷만 갱신 |
| `GET /api/cron-report` | Vercel Cron이 매일 09:17(KST) 호출. 가입 후 꽉 찬 달이 하나 늘어난 사람에게만 발송 |
| `GET/POST /api/unsubscribe` | 메일 속 링크. GET은 확인 화면, POST가 실제 수신거부 |

## 1. Supabase
1. 새 프로젝트를 만듭니다(리전은 Seoul 권장).
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Project Settings → API에서 `Project URL`과 `service_role` 키를 확인합니다. service_role 키는 브라우저 코드에 절대 넣지 않습니다.

## 2. Resend
1. 도메인을 추가하고 DNS(SPF/DKIM)를 인증합니다. 인증 전에는 본인 주소로만 보낼 수 있습니다.
2. API 키를 만듭니다(Sending access).

## 3. Vercel 환경변수
Project → Settings → Environment Variables에 `.env.example`의 항목을 넣습니다(Production, Preview 모두).

- `UNSUBSCRIBE_SECRET`, `CRON_SECRET`: `openssl rand -base64 32` 등으로 만든 긴 무작위 문자열
- `SITE_URL`: 운영 주소(예: `https://tikklemoa.vercel.app`)

Vercel Cron은 Production 배포에서만 실행됩니다. 프리뷰에서 발송을 확인하려면 아래처럼 직접 호출합니다.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/cron-report
```

## 한도와 동작
- Resend 무료: 하루 100통, 월 3,000통. 한 번 실행에 `REPORT_MAX_PER_RUN`(기본 90)통까지만 보내고 남은 사람은 다음 날 보냅니다.
- 구독자마다 가입일 기준으로 한 달이 찰 때 발송되므로 발송이 날짜별로 분산됩니다.
- 환경변수가 비어 있으면 API는 503(`not_configured`)을 돌려주고, 화면에는 실패 메시지가 뜹니다(입력값은 브라우저에 유지).

## 테스트
```bash
npm test
```
외부 서비스 없이 가짜 fetch로 가입·발송·수신거부를 검사합니다.
