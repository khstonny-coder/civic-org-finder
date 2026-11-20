// 단체 신청 승인·거절 (PLAN 작업 19번, DESIGN 4.4): 관리자 전용
// 승인하면 단체 정보를 갱신(또는 새로 등록)하고 수정 이력을 남긴다. 그러면 챗봇 검색에 바로 반영된다.
// 거절하면 사유를 남기고, 신청자는 고쳐서 다시 신청할 수 있다.
import { requireAdmin } from "../../../../../lib/auth/require.ts";
import { diffPayload, isUuid, parseSubmissionDecision } from "../../../../../lib/admin/rules.ts";
import { normalizeName } from "../../../../../scripts/collect/names.mts";
import { parseSubmission, type SubmissionPayload } from "../../../../../lib/orgs/submission.ts";
import { createAdminClient } from "../../../../../lib/supabase/admin.ts";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/submissions/[id]">): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ ok: false, message: "신청을 찾을 수 없습니다." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseSubmissionDecision(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });

  const admin = createAdminClient();
  const { data: sub } = await admin.from("org_submissions").select("*").eq("id", id).maybeSingle();
  if (!sub) return Response.json({ ok: false, message: "신청을 찾을 수 없습니다." }, { status: 404 });
  if (sub.status !== "pending") return Response.json({ ok: false, message: "이미 처리된 신청입니다." }, { status: 409 });
  const now = new Date().toISOString();

  if (parsed.value.decision === "reject") {
    const { error } = await admin
      .from("org_submissions")
      .update({ status: "rejected", reject_reason: parsed.value.reason, decided_at: now, decided_by: auth.user.id })
      .eq("id", id);
    if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
    return Response.json({ ok: true, message: "거절했습니다." });
  }

  // ─ 승인 ─
  // 신청 내용을 DB에서 다시 꺼내 한 번 더 검사한다. (API를 거치지 않고 직접 저장된 신청이 개인 연락처 같은 금지 값을 싣고 올 수 있다)
  const recheck = parseSubmission(sub.payload);
  if (!recheck.ok) {
    return Response.json({ ok: false, message: `신청 내용이 올바르지 않아 승인할 수 없습니다: ${recheck.message} 거절 처리해 주세요.` }, { status: 400 });
  }
  const payload: SubmissionPayload = recheck.payload;
  // 신청이 가리키는 단체가 신청자의 소속 단체와 같은지 확인한다. (남의 단체 수정 신청 방지)
  const { data: submitter } = await admin.from("profiles").select("role, org_id").eq("user_id", sub.submitted_by).maybeSingle();
  if (!submitter || submitter.role !== "org") {
    return Response.json({ ok: false, message: "신청자가 승인된 단체 담당자가 아닙니다." }, { status: 409 });
  }
  if ((sub.org_id ?? null) !== (submitter.org_id ?? null)) {
    return Response.json({ ok: false, message: "신청이 가리키는 단체가 신청자의 소속 단체와 다릅니다. 거절 처리해 주세요." }, { status: 409 });
  }
  const fields = {
    name: payload.name,
    name_normalized: normalizeName(payload.name),
    region_code: payload.region_code,
    field: payload.field,
    description: payload.description,
    source_url: payload.source_url,
    contact_phone: payload.contact_phone,
    contact_email: payload.contact_email,
    contact_source_url: payload.contact_source_url,
    collected_at: now, // 단체가 직접 확인한 정보이므로 "수집일"을 오늘로 갱신한다
    needs_review: false,
  };

  let orgId: string = sub.org_id;
  let before = null;
  if (orgId) {
    const { data: current } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();
    if (!current) return Response.json({ ok: false, message: "수정할 단체를 찾을 수 없습니다." }, { status: 404 });
    before = current;
    const { error } = await admin.from("organizations").update(fields).eq("id", orgId);
    if (error) return Response.json({ ok: false, message: conflictMessage(error) }, { status: error.code === "23505" ? 409 : 500 });
  } else {
    const { data: created, error } = await admin
      .from("organizations")
      .insert({ ...fields, status: "published" })
      .select("id")
      .single();
    if (error || !created) return Response.json({ ok: false, message: conflictMessage(error) }, { status: error?.code === "23505" ? 409 : 500 });
    orgId = created.id as string;
    // 새로 등록한 단체는 신청자의 소속 단체로 연결한다.
    await admin.from("profiles").update({ org_id: orgId }).eq("user_id", sub.submitted_by);
  }

  // 수정 이력과 신청 처리 기록
  const changes = diffPayload(before, payload);
  const { error: revError } = await admin
    .from("org_revisions")
    .insert({ org_id: orgId, changed_by: auth.user.id, changes: before ? changes : { ...changes, _created: true } });
  if (revError) console.error("수정 이력 저장 오류:", revError.message);

  const { error: decideError } = await admin
    .from("org_submissions")
    .update({ status: "approved", org_id: orgId, decided_at: now, decided_by: auth.user.id })
    .eq("id", id);
  if (decideError) {
    console.error("신청 처리 기록 오류:", decideError.message);
    return Response.json({ ok: false, message: "단체 정보는 반영했지만 신청 상태를 바꾸지 못했습니다. 다시 확인해 주세요." }, { status: 500 });
  }
  return Response.json({ ok: true, message: "승인했습니다. 챗봇 검색에 반영됩니다." });
}

function conflictMessage(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23505") return "같은 이름·같은 시·군·구의 단체가 이미 있습니다. 중복 여부를 확인해 주세요.";
  console.error("승인 처리 오류:", error?.message);
  return "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
