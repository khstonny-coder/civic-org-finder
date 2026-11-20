// 단체 담당자 본인 확인 후 승인 (PLAN 작업 19번, DESIGN 4.5): 관리자 전용
// 관리자가 공개 대표 이메일·공식 홈페이지로 본인 확인을 마친 뒤, 기존 단체를 연결하거나(orgId) 연결 없이 승인한다.
// 연결 없이 승인하면 담당자가 새 단체 등록을 신청할 수 있고, 그 신청을 승인할 때 단체가 연결된다.
import { requireAdmin } from "../../../../../lib/auth/require.ts";
import { isUuid, parseUserApproval } from "../../../../../lib/admin/rules.ts";
import { createAdminClient } from "../../../../../lib/supabase/admin.ts";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ ok: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseUserApproval(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", id).maybeSingle();
  if (!profile) return Response.json({ ok: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  // 승인 대기 계정만 올릴 수 있다. (공무원·관리자·이미 승인된 계정은 건드리지 않는다)
  if (profile.role !== "org_pending") {
    return Response.json({ ok: false, message: "승인 대기 중인 단체 담당자가 아닙니다." }, { status: 409 });
  }
  if (parsed.orgId) {
    const { data: org } = await admin.from("organizations").select("id").eq("id", parsed.orgId).maybeSingle();
    if (!org) return Response.json({ ok: false, message: "연결할 단체를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await admin.from("profiles").update({ role: "org", org_id: parsed.orgId }).eq("user_id", id);
  if (error) {
    console.error("담당자 승인 오류:", error.message);
    return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
  }
  return Response.json({ ok: true, message: "본인 확인을 마치고 승인했습니다." });
}
