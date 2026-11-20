// 단체의 등록·수정 신청 (PLAN 작업 18번, DESIGN 4.4)
// - 본인 확인이 끝난 단체 담당자(역할 org)만 신청할 수 있다. (DB 접근 규칙이 한 번 더 확인한다)
// - 신청은 '승인 대기'로만 저장되고, 공개 정보(챗봇이 쓰는 값)는 관리자가 승인하기 전까지 바뀌지 않는다.
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "../../../lib/auth/server.ts";
import { parseSubmission } from "../../../lib/orgs/submission.ts";
import { createClient } from "../../../lib/supabase/server.ts";

async function requireOrg(): Promise<{ user: User } | { error: Response }> {
  const current = await getCurrentUser();
  if (!current) return { error: Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 }) };
  if (current.role !== "org") {
    return { error: Response.json({ ok: false, message: "본인 확인이 끝난 단체 담당자만 이용할 수 있습니다." }, { status: 403 }) };
  }
  return { user: current.user };
}

/** 내 단체 정보, 내 신청 목록, 내 단체의 수정 이력 */
export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if ("error" in auth) return auth.error;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("user_id", auth.user.id).maybeSingle();
  const { data: org } = profile?.org_id
    ? await supabase.from("organizations").select("*").eq("id", profile.org_id).maybeSingle()
    : { data: null };
  const { data: submissions } = await supabase
    .from("org_submissions")
    .select("id, payload, status, reject_reason, created_at, decided_at")
    .eq("submitted_by", auth.user.id)
    .order("created_at", { ascending: false });
  const { data: revisions } = profile?.org_id
    ? await supabase
        .from("org_revisions")
        .select("id, changes, created_at")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false })
    : { data: [] };
  return Response.json({ ok: true, org, submissions, revisions });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireOrg();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseSubmission(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });

  const supabase = await createClient();
  // 처리 전 신청이 있으면 새로 받지 않는다. (관리자가 한 번에 한 건씩 보게)
  const { count: pending } = await supabase
    .from("org_submissions")
    .select("id", { count: "exact", head: true })
    .eq("submitted_by", auth.user.id)
    .eq("status", "pending");
  if ((pending ?? 0) > 0) {
    return Response.json({ ok: false, message: "이미 처리를 기다리는 신청이 있습니다. 결과가 나온 뒤 다시 신청해 주세요." }, { status: 409 });
  }

  // 관리자가 연결해 준 내 단체가 있으면 '수정 신청', 없으면 '새 등록 신청'
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("user_id", auth.user.id).maybeSingle();
  const { error } = await supabase.from("org_submissions").insert({
    org_id: profile?.org_id ?? null,
    submitted_by: auth.user.id,
    payload: parsed.payload,
  });
  if (error) {
    console.error("신청 저장 오류:", error.message);
    return Response.json({ ok: false, message: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return Response.json({ ok: true, message: "신청했습니다. 관리자가 확인한 뒤 반영됩니다.", notes: parsed.notes });
}
