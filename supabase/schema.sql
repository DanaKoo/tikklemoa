-- 티끌모아 월 1회 리포트 구독자 테이블 (Supabase SQL Editor에서 한 번 실행)
-- 서버(API)만 service_role 키로 접근한다. 브라우저에서 직접 접근하지 않도록 RLS를 켜고 정책을 두지 않는다.

create extension if not exists pgcrypto;

create table if not exists public.subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique check (email = lower(email) and length(email) <= 254),
  consent_privacy_at  timestamptz not null,           -- 개인정보 수집·이용 동의 시각
  consent_report_at   timestamptz not null,           -- 월 1회 리포트 수신 동의 시각
  consent_version     text not null,                  -- 동의 문구 버전
  snapshot            jsonb not null,                 -- 가입 시점 입력값 {A, P, ra, T, N} (만 원, %, 년)
  snapshot_at         timestamptz not null,           -- 스냅샷 기준 시각 (경과 개월 계산 기준)
  last_report_month   integer not null default 0,     -- 마지막으로 보낸 리포트의 경과 개월 수
  last_sent_at        timestamptz,
  unsubscribed_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscribers_active_idx on public.subscribers (snapshot_at) where unsubscribed_at is null;

alter table public.subscribers enable row level security;
-- 정책 없음 = anon/authenticated 키로는 읽기·쓰기 불가. service_role은 RLS를 우회한다.
