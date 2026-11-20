// DB 표의 데이터 모양 정의 (supabase/migrations의 표와 같아야 한다).
// DESIGN 5번 데이터 모델 참고. 나중에 Supabase가 자동으로 만들어 주는 타입으로 바꿀 수 있다.

/** 사용자 역할: 공무원 / 단체 담당자(본인 확인 전) / 단체 담당자 / 관리자 */
export type UserRole = "official" | "org_pending" | "org" | "admin";

/** 단체의 공개 상태 */
export type OrgStatus = "published" | "pending" | "hidden";

/** 참석 상태 */
export type Attendance = "undecided" | "attending" | "absent";

export type Region = {
  code: string;
  sido: string;
  sigungu: string;
  aliases: string[];
  former_names: string[];
  neighbor_codes: string[];
};

export type Organization = {
  id: string;
  name: string;
  name_normalized: string;
  region_code: string;
  field: string;
  description: string | null;
  source_url: string;
  collected_at: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
  status: OrgStatus;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  user_id: string;
  role: UserRole;
  org_id: string | null;
  org_name_requested: string | null;
  created_at: string;
};

export type Meeting = {
  id: string;
  owner_id: string;
  title: string;
  region_code: string | null;
  held_on: string;
  purge_after: string;
  created_at: string;
};

export type MeetingOrg = {
  meeting_id: string;
  org_id: string;
  attendance: Attendance;
};

/** DB에 만들어 두는 표 이름 목록 (연결 확인 스크립트가 같은 이름을 쓴다) */
export const TABLE_NAMES = [
  "regions",
  "organizations",
  "profiles",
  "org_revisions",
  "org_submissions",
  "org_reports",
  "meetings",
  "meeting_orgs",
  "chat_logs",
  "collect_runs",
] as const;
