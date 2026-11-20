// 오류 신고 저장 (PLAN 작업 15번, DESIGN 4.3): 신고를 저장하고 해당 단체를 "확인 필요"로 바꾼다.
// - 로그인한 공무원·관리자만 할 수 있다. (신고 저장은 DB 접근 규칙이 한 번 더 확인한다)
// - 신고자 본인이 볼 수 있는 공개 단체만 신고할 수 있다.
// - 같은 사람이 같은 단체를 처리 전에 또 신고하면 새로 저장하지 않는다. 한 사람이 1시간에 10건까지만 신고할 수 있다.
import { canUseChat } from "../../../lib/auth/roles.ts";
import { getCurrentUser } from "../../../lib/auth/server.ts";
import { parseReport } from "../../../lib/reports/validate.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { createClient } from "../../../lib/supabase/server.ts";

const MAX_REPORTS_PER_HOUR = 10;

export async function POST(request: Request): Promise<Response> {
  const current = await getCurrentUser();
  if (!current) return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (!canUseChat(current.role)) {
    return Response.json({ ok: false, message: "공무원 또는 관리자 계정만 신고할 수 있습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseReport(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  const { orgId, reason, detail } = parsed.report;

  try {
    // 신고자가 볼 수 있는(공개된) 단체인지 로그인 사용자 권한으로 확인한다.
    const supabase = await createClient();
    const { data: org } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
    if (!org) return Response.json({ ok: false, message: "신고할 단체를 찾을 수 없습니다." }, { status: 404 });

    const admin = createAdminClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from("org_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", current.user.id)
      .gte("created_at", since);
    if ((recent ?? 0) >= MAX_REPORTS_PER_HOUR) {
      return Response.json({ ok: false, message: "신고를 너무 많이 했습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    const { count: duplicate } = await admin
      .from("org_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", current.user.id)
      .eq("org_id", orgId)
      .eq("status", "open");

    if ((duplicate ?? 0) === 0) {
      // 신고 저장은 신고자 본인 권한으로 한다. (본인 이름으로만 저장되는 규칙이 DB에 있다)
      const { error } = await supabase
        .from("org_reports")
        .insert({ org_id: orgId, reporter_id: current.user.id, reason, detail });
      if (error) throw new Error(error.message);
    }

    // 단체 정보 쓰기는 서버 전용이라 관리자 열쇠로 "확인 필요"를 켠다.
    const { error: flagError } = await admin.from("organizations").update({ needs_review: true }).eq("id", orgId);
    if (flagError) throw new Error(flagError.message);

    return Response.json({ ok: true, message: "신고했습니다. 관리자가 확인합니다." });
  } catch (e) {
    console.error("신고 저장 오류:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
