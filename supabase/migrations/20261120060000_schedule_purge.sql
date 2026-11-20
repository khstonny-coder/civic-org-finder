-- 개인정보 보관기간 자동 삭제 예약 (PLAN 작업 16번, PRD 7번)
-- 매일 새벽 3시 17분(한국 시간)에 purge_expired_records()를 실행한다:
--   · 간담회일 + 90일이 지난 간담회(초청·참석 기록 포함)
--   · 90일 지난 챗봇 답변 기록
-- Supabase의 예약 작업 기능(pg_cron)을 쓴다. 같은 이름으로 다시 실행해도 예약이 중복되지 않는다.

create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-records',
  '17 18 * * *',  -- 18:17 UTC = 03:17 KST
  $$select public.purge_expired_records()$$
);
