-- 보안 강화 (PLAN 작업 23번, 보안 검토 반영): API에서만 확인하던 규칙을 DB에도 둔다.
-- 앱의 API를 거치지 않고 공개 키로 DB에 직접 요청해도 같은 규칙에 걸리게 하려는 것이다.
-- 기존 자료는 모두 이 규칙을 지키고 있어서 적용해도 바뀌는 자료가 없다.

-- 1) 단체 신청: 내 소속 단체에 대한 신청(또는 소속이 없으면 새 등록 신청)만 낼 수 있고,
--    처리 결과 칸(거절 사유·처리자)을 신청자가 미리 채울 수 없다.
drop policy org_submissions_insert on public.org_submissions;
create policy org_submissions_insert on public.org_submissions
  for insert to authenticated
  with check (
    public.app_role() = 'org'
    and submitted_by = auth.uid()
    and status = 'pending'
    and decided_at is null
    and decided_by is null
    and reject_reason is null
    and org_id is not distinct from public.app_org_id()
  );

-- 2) 글자 수 제한 (API와 같은 값)
alter table public.org_reports  add constraint org_reports_detail_length  check (detail is null or char_length(detail) <= 200);
alter table public.meetings     add constraint meetings_title_length      check (char_length(title) between 1 and 100);
alter table public.org_submissions add constraint org_submissions_payload_object check (jsonb_typeof(payload) = 'object');

-- 3) 신고는 사용자가 볼 수 있는(공개된) 단체에 대해서만 낼 수 있다. (공무원·관리자는 공개 단체만 읽는 규칙을 그대로 따른다)
drop policy org_reports_insert on public.org_reports;
create policy org_reports_insert on public.org_reports
  for insert to authenticated
  with check (
    public.app_role() in ('official', 'admin')
    and reporter_id = auth.uid()
    and status = 'open'
    and exists (select 1 from public.organizations o where o.id = org_id and o.status = 'published')
  );

-- 4) 간담회에는 공개된 단체만 초청할 수 있다.
drop policy meeting_orgs_owner_all on public.meeting_orgs;
create policy meeting_orgs_owner_all on public.meeting_orgs
  for all to authenticated
  using (
    public.app_role() = 'official'
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  )
  with check (
    public.app_role() = 'official'
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
    and exists (select 1 from public.organizations o where o.id = org_id and o.status = 'published')
  );

-- 5) set_updated_at 함수에 검색 경로를 고정한다. (Supabase 보안 점검 경고 해소)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
