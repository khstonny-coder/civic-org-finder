// 오류 신고 처리 (PLAN 작업 19번, DESIGN 4.3): 관리자 전용
// 수정 완료 / 단체 숨김 / 기각 중 하나를 고른다. 같은 단체에 처리 안 된 신고가 더는 없으면 "확인 필요" 표시를 푼다.
import { requireAdmin } from "../../../../../lib/auth/require.ts";
import { isUuid, parseReportAction } from "../../../../../lib/admin/rules.ts";
import { createAdminClient } from "../../../../../lib/supabase/admin.ts";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/reports/[id]">): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ ok: false, message: "신고를 찾을 수 없습니다." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const action = parseReportAction(body);
  if (!action) return Response.json({ ok: false, message: "처리 방법을 골라 주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: report } = await admin.from("org_reports").select("id, org_id, status").eq("id", id).maybeSingle();
  if (!report) return Response.json({ ok: false, message: "신고를 찾을 수 없습니다." }, { status: 404 });
  if (report.status !== "open") return Response.json({ ok: false, message: "이미 처리된 신고입니다." }, { status: 409 });

  const now = new Date().toISOString();
  if (action === "hide") {
    // 단체를 숨기면 챗봇 검색에 나오지 않는다. 그 단체에 대한 처리 전 신고는 모두 처리된 것으로 본다.
    const { error } = await admin.from("organizations").update({ status: "hidden", needs_review: false }).eq("id", report.org_id);
    if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
    await admin
      .from("org_reports")
      .update({ status: "resolved", handled_at: now })
      .eq("org_id", report.org_id)
      .eq("status", "open");
    return Response.json({ ok: true, message: "단체를 숨겼습니다. 챗봇에 나오지 않습니다." });
  }

  const { error } = await admin
    .from("org_reports")
    .update({ status: action === "resolve" ? "resolved" : "dismissed", handled_at: now })
    .eq("id", id);
  if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });

  const { count: stillOpen } = await admin
    .from("org_reports")
    .select("id", { count: "exact", head: true })
    .eq("org_id", report.org_id)
    .eq("status", "open");
  if ((stillOpen ?? 0) === 0) await admin.from("organizations").update({ needs_review: false }).eq("id", report.org_id);
  return Response.json({ ok: true, message: "처리했습니다." });
}
