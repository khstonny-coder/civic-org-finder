-- 우리동네 시민단체 찾기 — DB 표 만들기 (PLAN 작업 1번, DESIGN 5번 데이터 모델)
-- 이 파일은 Supabase DB에 표와 접근 규칙(행 단위 보안)을 만든다.
-- 쓰기는 대부분 서버(서비스 키)가 하고, 화면에서 직접 쓰는 것은 아래 정책에 적힌 경우뿐이다.

-- ─────────────────────────────────────────────
-- 1. 공통 도구
-- ─────────────────────────────────────────────

-- 수정 시각을 자동으로 갱신한다.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 2. 표
-- ─────────────────────────────────────────────

-- 지역 표: 검색 기준이 되는 전국 시·군·구 (내용은 PLAN 3번에서 채운다)
create table public.regions (
  code           text primary key,                    -- 행정구역 코드
  sido           text not null,                       -- 시·도
  sigungu        text not null,                       -- 시·군·구
  aliases        text[] not null default '{}',        -- 약칭 (예: 경남)
  former_names   text[] not null default '{}',        -- 옛 명칭 (행정구역 개편 전 이름)
  neighbor_codes text[] not null default '{}',        -- 인접 지역 코드
  unique (sido, sigungu)
);

-- 단체 정보 본체
create table public.organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,                   -- 단체명
  name_normalized    text not null,                   -- (사)·(재)·띄어쓰기를 정리한 이름 (중복 판단용)
  region_code        text not null references public.regions (code),
  field              text not null,                   -- 분야
  description        text,                            -- 한 줄 설명
  source_url         text not null check (source_url <> ''),  -- 출처 URL
  collected_at       timestamptz not null default now(),      -- 수집일
  contact_phone      text,                            -- 기관 대표전화 (개인 번호 저장 금지)
  contact_email      text,                            -- 기관 대표이메일 (개인 이메일 저장 금지)
  contact_source_url text,                            -- 연락처 출처 URL
  status             text not null default 'published'
                       check (status in ('published', 'pending', 'hidden')),  -- 공개·대기·숨김
  needs_review       boolean not null default false,  -- "확인 필요" 표시
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (name_normalized, region_code),              -- 같은 이름·같은 시·군·구는 한 건
  -- 연락처를 저장하면 반드시 출처가 있어야 한다.
  check ((contact_phone is null and contact_email is null) or contact_source_url is not null)
);

create index organizations_region_status_idx on public.organizations (region_code, status);
create index organizations_field_idx on public.organizations (field);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- 로그인 사용자 부가 정보
-- 역할: official(공무원) / org_pending(단체 담당자, 본인 확인 전) / org(단체 담당자) / admin(관리자)
-- 새 가입자는 항상 org_pending으로 시작한다. 공무원·단체·관리자로 올리는 일은 서버(서비스 키)나
-- 운영자가 Supabase 화면에서만 한다. (사용자가 자기 역할을 바꿀 정책은 만들지 않는다.)
create table public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  role               text not null default 'org_pending'
                       check (role in ('official', 'org_pending', 'org', 'admin')),
  org_id             uuid references public.organizations (id) on delete set null,  -- 소속 단체
  org_name_requested text,                            -- 단체 담당자가 가입 때 적은 단체명
  created_at         timestamptz not null default now()
);

-- 수정 이력
create table public.org_revisions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  changed_by uuid references auth.users (id) on delete set null,
  changes    jsonb not null,                          -- 바뀐 내용
  created_at timestamptz not null default now()
);

-- 단체의 등록·수정 신청 (관리자 승인 전까지 공개 정보는 그대로)
create table public.org_submissions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations (id) on delete cascade,  -- 새 등록이면 비어 있음
  submitted_by  uuid not null references auth.users (id) on delete cascade,
  payload       jsonb not null,                       -- 제출 내용
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id) on delete set null,
  -- 거절하면 사유가 있어야 한다.
  check (status <> 'rejected' or reject_reason is not null)
);

create index org_submissions_status_idx on public.org_submissions (status, created_at);

-- 오류 신고 ("정보가 틀렸어요")
create table public.org_reports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('closed', 'moved', 'contact_changed', 'other')),
  detail      text,
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);

create index org_reports_status_idx on public.org_reports (status, created_at);

-- 간담회 (간담회일 + 90일 뒤 삭제 대상)
create table public.meetings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  region_code text references public.regions (code),
  held_on     date not null,                          -- 간담회일
  purge_after date generated always as (held_on + 90) stored,  -- 삭제 예정일
  created_at  timestamptz not null default now()
);

create index meetings_owner_idx on public.meetings (owner_id);

-- 초청·참석 기록
create table public.meeting_orgs (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  attendance text not null default 'undecided'
               check (attendance in ('undecided', 'attending', 'absent')),  -- 미정·참석·불참
  primary key (meeting_id, org_id)
);

-- 챗봇 답변 기록: 출처 비율·정확도 점검의 원자료.
-- 사용자 식별 정보와 질문 원문은 저장하지 않는다. 90일 뒤 삭제한다.
create table public.chat_logs (
  id          uuid primary key default gen_random_uuid(),
  region_code text references public.regions (code) on delete set null,
  field       text,
  org_ids     uuid[] not null default '{}',           -- 답변에 나온 단체 ID
  created_at  timestamptz not null default now()
);

create index chat_logs_created_idx on public.chat_logs (created_at);

-- 수집 결과 기록 (관리 화면의 "수집 결과")
create table public.collect_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  saved_count      integer not null default 0,
  excluded_count   integer not null default 0,
  excluded_reasons jsonb not null default '{}'::jsonb,  -- 제외 사유별 건수
  note             text
);

-- ─────────────────────────────────────────────
-- 3. 새 가입자의 profiles 자동 생성
-- ─────────────────────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, org_name_requested)
  values (
    new.id,
    'org_pending',
    nullif(left(new.raw_user_meta_data ->> 'org_name', 100), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 4. 접근 규칙 (행 단위 보안)
-- ─────────────────────────────────────────────

-- 현재 로그인한 사람의 역할·소속 단체 (정책 안에서 profiles를 다시 조회하며 생기는 꼬임을 피하려고 함수로 둔다)
create function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create function public.app_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where user_id = auth.uid()
$$;

revoke all on function public.app_role() from public;
revoke all on function public.app_org_id() from public;
grant execute on function public.app_role() to authenticated;
grant execute on function public.app_org_id() to authenticated;

alter table public.regions        enable row level security;
alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.org_revisions  enable row level security;
alter table public.org_submissions enable row level security;
alter table public.org_reports    enable row level security;
alter table public.meetings       enable row level security;
alter table public.meeting_orgs   enable row level security;
alter table public.chat_logs      enable row level security;
alter table public.collect_runs   enable row level security;

-- 지역 표: 로그인한 사람은 누구나 읽는다.
create policy regions_read on public.regions
  for select to authenticated using (true);

-- 단체: 공무원·관리자는 공개된 단체만, 단체 담당자는 자기 단체만 읽는다. (쓰기는 서버 전용)
create policy organizations_read_published on public.organizations
  for select to authenticated
  using (status = 'published' and public.app_role() in ('official', 'admin'));

create policy organizations_read_own on public.organizations
  for select to authenticated
  using (id = public.app_org_id());

-- 프로필: 본인 것만 읽는다. 관리자는 전체. (쓰기 정책 없음: 역할은 서버·운영자만 바꾼다)
create policy profiles_read_own on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy profiles_read_admin on public.profiles
  for select to authenticated using (public.app_role() = 'admin');

-- 수정 이력: 관리자와 해당 단체 담당자만 읽는다.
create policy org_revisions_read on public.org_revisions
  for select to authenticated
  using (public.app_role() = 'admin' or org_id = public.app_org_id());

-- 신청: 본인 것과 관리자만 읽는다. 본인 확인이 끝난 단체 담당자(org)만 대기 상태로 새로 낼 수 있다.
create policy org_submissions_read on public.org_submissions
  for select to authenticated
  using (submitted_by = auth.uid() or public.app_role() = 'admin');

create policy org_submissions_insert on public.org_submissions
  for insert to authenticated
  with check (
    public.app_role() = 'org'
    and submitted_by = auth.uid()
    and status = 'pending'
    and decided_at is null
  );

-- 신고: 공무원·관리자가 본인 이름으로 쓰고, 관리자만 읽는다.
create policy org_reports_insert on public.org_reports
  for insert to authenticated
  with check (
    public.app_role() in ('official', 'admin')
    and reporter_id = auth.uid()
    and status = 'open'
  );

create policy org_reports_read_admin on public.org_reports
  for select to authenticated using (public.app_role() = 'admin');

-- 간담회·초청 기록: 만든 공무원 본인만 읽고 쓴다. (관리자도 접근하지 않는다)
create policy meetings_owner_all on public.meetings
  for all to authenticated
  using (owner_id = auth.uid() and public.app_role() = 'official')
  with check (owner_id = auth.uid() and public.app_role() = 'official');

create policy meeting_orgs_owner_all on public.meeting_orgs
  for all to authenticated
  using (
    public.app_role() = 'official'
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  )
  with check (
    public.app_role() = 'official'
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  );

-- 수집 결과: 관리자만 읽는다. (쓰기는 서버 전용)
create policy collect_runs_read_admin on public.collect_runs
  for select to authenticated using (public.app_role() = 'admin');

-- 답변 기록: 화면에서 읽거나 쓰는 정책을 만들지 않는다. (서버 전용)

-- ─────────────────────────────────────────────
-- 5. 기간이 지난 기록 삭제 함수
-- ─────────────────────────────────────────────
-- 삭제 예정일이 지난 간담회(초청·참석 기록 포함)와 90일 지난 답변 기록을 지운다.
-- 하루 한 번 실행하는 예약은 PLAN 16번(간담회 관리)에서 Supabase 예약 작업 지원 여부를 확인한 뒤 연결한다.
create function public.purge_expired_records()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.meetings where purge_after < current_date;
  delete from public.chat_logs where created_at < now() - interval '90 days';
$$;

revoke all on function public.purge_expired_records() from public;
revoke all on function public.purge_expired_records() from anon, authenticated;
